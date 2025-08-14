### Spec 07 – LLM Tool Binding and Agent Loop

- **Status**: Proposed
- **Owner**: AI
- **Last Updated**: 2025-08-14
- **Scope**: Chat streaming and tool execution

### Summary
Bind GA4 tools to the LLM and implement a minimal agent loop that executes tool calls and streams final text. If GA auth is missing, emit an SSE action instructing the UI to prompt Google OAuth.

### Changes
- File: `src/features/ai-chat/chat.ts`
  - Import GA4 tools from Spec 05.
  - Bind them to the LLM: `llm.bindTools([...])`.
  - Replace `llm.stream(allMessages)` with a loop that:
    - Invokes the model; if tool calls are present, executes them and appends tool results to the message history.
    - Continues until an assistant text response is produced.
    - Streams only assistant text tokens.
  - Catch `NEEDS_GOOGLE_OAUTH` and surface a typed SSE action event.
- File: `src/app/api/chat/route.ts`
  - Emit SSE `action` event when the agent loop signals OAuth is needed:
```json
{ "type": "action", "action": "connect_google", "url": "/api/auth/signin?provider=google&callbackUrl=/[locale]/chat" }
```

### Implementation Notes
- Maintain current SSE `type: 'text'` messages and `[DONE]` signal.
- Stream assistant tokens as they arrive; for tool execution, buffer/iterate until final text.
- Keep the system prompt and user personalization intact.

### Acceptance Criteria
- Normal chats stream as before.
- When the model calls a GA tool, the tool is executed and results are incorporated into the assistant response.
- If GA auth missing, an SSE `action` is sent; the text stream includes a concise prompt to connect Google; stream still concludes with `[DONE]`.

### Tests
- **Baseline streaming**: Without tool calls, stream emits only `text` and `[DONE]`.
- **Tool execution**: Prompt that induces a GA tool call → tool runs (stubbed), assistant streams final text incorporating results.
- **OAuth required**: Stub tools to throw `NEEDS_GOOGLE_OAUTH` → SSE event `{ type: 'action', action: 'connect_google', url }` is emitted, followed by a brief guidance message and `[DONE]`.
- **Resilience**: Unexpected tool errors are surfaced as a single concise error message to the user without breaking the stream.
