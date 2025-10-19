# Spec 06: Enhanced Chat Error Handling for OAuth Issues

## Objective
Improve error handling in the AI chat interface to gracefully handle Google OAuth errors, provide clear user feedback, and enable seamless recovery without interrupting the conversation.

## Current State
- GA4 tool errors are caught generically in `chunk-loop.ts`
- Error messages shown as tool failures with JSON payload
- No distinction between OAuth errors and other errors
- Users don't get clear path to resolution
- Chat continues but subsequent GA4 queries also fail

## Proposed Changes

### 1. Error Detection in Tool Execution

**File**: `src/features/ai-chat/stream/chunk-loop.ts`

Enhance tool error handling to detect OAuth errors:

```typescript
import { GoogleOAuthRequired } from "@/server/google/client";
import type { NeedsGoogleOAuthError } from "@/server/google/client";

// Add at top of file
function isOAuthError(err: unknown): err is GoogleOAuthRequired {
  return (
    err instanceof Error &&
    err.name === "GoogleOAuthRequired" &&
    "authorizeUrl" in err
  );
}

// Update tool execution block (around line 121-141)
try {
  console.log("calling tool", call.name);
  console.log("call.args", call.args);

  const args =
    typeof call.args === "string"
      ? safeParse(call.args)
      : (call.args as Record<string, unknown>);

  const result = (await tool.invoke(args ?? {})) as string;
  console.log("result", result);

  workingMessages.push(new ToolMessage(result, call.id ?? tool.name));
} catch (err) {
  // NEW: Special handling for OAuth errors
  if (isOAuthError(err)) {
    const oauthError = err.toJSON();
    const errorPayload = JSON.stringify({
      error: "OAUTH_REQUIRED",
      type: "google_oauth",
      reason: err.reason,
      userMessage: err.userMessage,
      authorizeUrl: err.authorizeUrl,
      canRetry: err.canRetry,
      tool: call.name,
    });

    console.error("OAuth error in tool execution:", errorPayload);
    workingMessages.push(
      new ToolMessage(errorPayload, call.id ?? tool.name),
    );
    continue;
  }

  // Existing generic error handling
  const message = err instanceof Error ? err.message : "Tool error";
  const errorPayload = JSON.stringify({
    error: message,
    tool: call.name,
  });

  console.error("tool error", errorPayload);
  workingMessages.push(
    new ToolMessage(errorPayload, call.id ?? tool.name),
  );
}
```

### 2. System Prompt Enhancement

**File**: `src/features/ai-chat/prompts/system.ts`

Add OAuth error handling instructions:

```typescript
export function buildSystemPrompt(
  userInfo?: UserInfo,
  selectedGa?: SelectedGaPropertyContext,
  maxToolRounds = 5,
): string {
  const basePrompt = `You are an e-commerce analytics assistant...`;

  // Add OAuth error handling section
  const oauthHandling = `

## Google OAuth Error Handling

If you receive a tool error with "OAUTH_REQUIRED":
1. DO NOT retry the tool - it will fail again
2. Explain to the user that their Google Analytics connection needs to be renewed
3. Provide the user-friendly message from the error
4. Inform them they can reconnect by clicking the reconnection prompt that will appear
5. Offer to help with other tasks that don't require GA4 data

Example response:
"I encountered an issue accessing your Google Analytics data. Your Google connection appears to have expired.

You'll see a banner at the top of the page with a 'Reconnect' button - clicking that will quickly restore access to your GA4 data. The process takes just a few seconds and your selected property will be preserved.

In the meantime, I'm happy to help you with other questions or tasks that don't require live analytics data."
`;

  return basePrompt + oauthHandling + `\n\n...`;
}
```

### 3. Error Message Component for Chat

**File**: `src/components/chat-message.tsx`

Update to detect and display OAuth errors specially:

```typescript
import { ChatOAuthError } from "@/components/chat-oauth-error";

// Add helper to detect OAuth errors in message content
function extractOAuthError(content: string): {
  isOAuthError: boolean;
  userMessage?: string;
  authorizeUrl?: string;
  reason?: string;
} | null {
  try {
    // Check if content contains OAuth error marker
    if (content.includes("OAUTH_REQUIRED")) {
      const parsed = JSON.parse(content);
      if (parsed.error === "OAUTH_REQUIRED") {
        return {
          isOAuthError: true,
          userMessage: parsed.userMessage,
          authorizeUrl: parsed.authorizeUrl,
          reason: parsed.reason,
        };
      }
    }
  } catch {
    // Not a JSON error message
  }
  return null;
}

export function ChatMessage({ message, ...props }: ChatMessageProps) {
  // NEW: Check if this is an assistant message containing OAuth error references
  if (message.role === "assistant") {
    const oauthError = extractOAuthError(message.content);

    // If we detect OAuth error metadata, enhance the display
    // Note: The AI should handle this gracefully, but we add UI safety net
    if (oauthError?.isOAuthError) {
      return (
        <div className={cn("group relative flex items-start", className)}>
          {/* ... avatar and other UI ... */}
          <div className="flex-1 space-y-2">
            <MemoizedMarkdown content={message.content} />
            <ChatOAuthError
              message={oauthError.userMessage || "Google Analytics connection required"}
              authorizeUrl={oauthError.authorizeUrl}
            />
          </div>
        </div>
      );
    }
  }

  // Existing message rendering
  return (
    <div className={cn("group relative flex items-start", className)}>
      {/* ... existing implementation ... */}
    </div>
  );
}
```

### 4. Chat-Level Error Boundary

**New File**: `src/components/chat-error-boundary.tsx`

```typescript
"use client";

import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractOAuthError } from "@/types/oauth-errors";

type ChatErrorBoundaryProps = {
  children: React.ReactNode;
};

type ChatErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
};

export class ChatErrorBoundary extends React.Component<
  ChatErrorBoundaryProps,
  ChatErrorBoundaryState
> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ChatErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Chat error boundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const oauthError = extractOAuthError(this.state.error);

      if (oauthError) {
        return (
          <div className="flex h-full items-center justify-center p-4">
            <Alert variant="destructive" className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Google Analytics Connection Issue</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{oauthError.userMessage}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      window.location.href = oauthError.authorizeUrl || "/api/auth/signin?provider=google";
                    }}
                  >
                    Reconnect Google
                  </Button>
                  <Button size="sm" variant="outline" onClick={this.handleReset}>
                    Dismiss
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        );
      }

      return (
        <div className="flex h-full items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="space-y-3">
              <p className="text-sm">
                {this.state.error?.message || "An unexpected error occurred"}
              </p>
              <Button size="sm" variant="outline" onClick={this.handleReset}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 5. Wrap Chat Component

**File**: `src/components/chat.tsx`

Wrap the chat component with error boundary:

```typescript
import { ChatErrorBoundary } from "./chat-error-boundary";

export function Chat({ id, initialMessages, className }: ChatProps) {
  return (
    <ChatErrorBoundary>
      <div className={cn("flex flex-col h-full", className)}>
        {/* ... existing chat implementation ... */}
      </div>
    </ChatErrorBoundary>
  );
}
```

### 6. Real-time Connection Monitoring in Chat

**File**: `src/components/chat.tsx`

Add connection monitoring:

```typescript
import { useGoogleConnectionStatus } from "@/hooks/use-google-connection-status";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function Chat({ id, initialMessages, className }: ChatProps) {
  const { needsReconnection, warningMessage } = useGoogleConnectionStatus();
  const [showWarning, setShowWarning] = React.useState(false);

  // Show warning if connection issues detected mid-chat
  React.useEffect(() => {
    if (needsReconnection && messages.length > 0) {
      setShowWarning(true);
    }
  }, [needsReconnection, messages.length]);

  return (
    <ChatErrorBoundary>
      <div className={cn("flex flex-col h-full", className)}>
        {/* Connection warning in chat */}
        {showWarning && needsReconnection && (
          <Alert variant="destructive" className="m-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {warningMessage || "Google Analytics connection issue detected"}
              {" - "}
              GA4 queries may fail until reconnected.
            </AlertDescription>
          </Alert>
        )}

        {/* ... existing chat implementation ... */}
      </div>
    </ChatErrorBoundary>
  );
}
```

### 7. Client-Side Error Type Definitions

**File**: `src/types/oauth-errors.ts`

Enhance with chat-specific types:

```typescript
export type OAuthErrorData = {
  isOAuthError: true;
  reason: string;
  userMessage: string;
  authorizeUrl: string;
  canRetry: boolean;
};

export type ChatToolOAuthError = {
  error: "OAUTH_REQUIRED";
  type: "google_oauth";
  reason: string;
  userMessage: string;
  authorizeUrl: string;
  canRetry: boolean;
  tool: string;
};

export function extractOAuthError(error: unknown): OAuthErrorData | null {
  // Check for direct OAuth error
  if (
    error &&
    typeof error === "object" &&
    "data" in error &&
    error.data &&
    typeof error.data === "object" &&
    "cause" in error.data
  ) {
    const cause = error.data.cause;
    if (
      cause &&
      typeof cause === "object" &&
      "isOAuthError" in cause &&
      cause.isOAuthError === true
    ) {
      return cause as OAuthErrorData;
    }
  }

  // Check for tool error format (from chat tools)
  if (
    error &&
    typeof error === "object" &&
    "error" in error &&
    error.error === "OAUTH_REQUIRED"
  ) {
    const toolError = error as ChatToolOAuthError;
    return {
      isOAuthError: true,
      reason: toolError.reason,
      userMessage: toolError.userMessage,
      authorizeUrl: toolError.authorizeUrl,
      canRetry: toolError.canRetry,
    };
  }

  // Check for error message string
  if (typeof error === "string") {
    try {
      const parsed = JSON.parse(error);
      if (parsed.error === "OAUTH_REQUIRED") {
        return {
          isOAuthError: true,
          reason: parsed.reason,
          userMessage: parsed.userMessage,
          authorizeUrl: parsed.authorizeUrl,
          canRetry: parsed.canRetry,
        };
      }
    } catch {
      // Not JSON
    }
  }

  return null;
}

export function isChatToolOAuthError(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return parsed.error === "OAUTH_REQUIRED";
  } catch {
    return false;
  }
}
```

## Implementation Steps

1. ✅ Update `chunk-loop.ts` with OAuth error detection
2. ✅ Enhance system prompt with OAuth handling instructions
3. ✅ Create chat error boundary component
4. ✅ Update `chat-message.tsx` to detect and display OAuth errors
5. ✅ Wrap chat component with error boundary
6. ✅ Add real-time connection monitoring to chat
7. ✅ Add type definitions for chat tool OAuth errors
8. ✅ Test error flows end-to-end

## Testing Scenarios

### Test Case 1: OAuth Error Mid-Chat
1. User starts chat with valid connection
2. Token expires/is revoked
3. User asks GA4 question
4. Tool detects OAuth error
5. AI responds with friendly message
6. UI shows reconnection prompt
7. ✅ User can reconnect without leaving chat

### Test Case 2: OAuth Error on First Message
1. User has expired token
2. Opens chat, asks GA4 question
3. Tool fails immediately
4. Banner shows at top
5. AI explains connection issue
6. ✅ Clear path to reconnection

### Test Case 3: Non-GA4 Questions Work
1. User has expired token
2. Asks non-GA4 question
3. ✅ Chat works normally
4. Asks GA4 question
5. Gets OAuth error
6. Asks non-GA4 question again
7. ✅ Chat continues working

### Test Case 4: Reconnection During Chat
1. User gets OAuth error
2. Clicks reconnect (new tab)
3. Completes OAuth flow
4. Returns to chat
5. Asks GA4 question again
6. ✅ Works without page refresh

## User Experience Flow

```
User: "Show me top products by revenue"
  ↓
Tool: OAuth error detected
  ↓
AI: "I encountered an issue accessing your Google Analytics data.
     Your connection has expired. You'll see a reconnection prompt
     - it only takes a few seconds to restore access."
  ↓
[Banner appears with "Reconnect Google" button]
  ↓
User clicks → OAuth flow → Success → Returns to chat
  ↓
User: "Show me top products by revenue"
  ↓
Tool: Success
  ↓
AI: [Shows data table]
```

## Edge Cases Handled

1. **Multiple OAuth errors in same round**: Only show banner once
2. **OAuth error + other tool errors**: Handle both gracefully
3. **Network errors vs OAuth errors**: Distinguish clearly
4. **Race condition**: User reconnects while message streaming
5. **Stale messages**: Don't show OAuth error for old messages

## Performance Considerations

- ✅ Error detection is synchronous (no additional latency)
- ✅ Connection status polling doesn't block chat
- ✅ Error boundary doesn't affect normal operation

## Accessibility

- ✅ Error messages readable by screen readers
- ✅ Reconnect button keyboard accessible
- ✅ Error alerts have proper ARIA roles

## Breaking Changes
None - enhances existing error handling.

## Dependencies
None - uses existing error handling infrastructure.

## Success Metrics

- Zero confused users (clear error messages)
- < 5 seconds to reconnect
- 100% reconnection success rate
- Chat usability maintained during errors
