# Spec 01: Enhanced Error Types and Error Handling

## Objective
Create structured, type-safe error responses that can be properly communicated from backend to frontend with actionable information for users.

## Current State
- `GoogleOAuthRequired` error exists but doesn't carry enough context
- tRPC converts errors generically, losing important metadata
- Frontend receives generic error messages
- No distinction between different OAuth failure scenarios

## Proposed Changes

### 1. Enhanced GoogleOAuthRequired Error Class

**File**: `src/server/google/client.ts`

```typescript
export enum GoogleAuthErrorReason {
  NO_ACCOUNT = "NO_ACCOUNT",
  MISSING_SCOPES = "MISSING_SCOPES",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  REFRESH_FAILED = "REFRESH_FAILED",
  TOKEN_REVOKED = "TOKEN_REVOKED",
}

export type NeedsGoogleOAuthError = {
  code: typeof ERROR_CODE_NEEDS_GOOGLE_OAUTH;
  reason: GoogleAuthErrorReason;
  message: string;
  userMessage: string; // User-friendly message
  authorizeUrl: string;
  canRetry: boolean; // Whether retry might work without reconnection
};

export class GoogleOAuthRequired extends Error {
  code: NeedsGoogleOAuthError["code"] = ERROR_CODE_NEEDS_GOOGLE_OAUTH;
  reason: GoogleAuthErrorReason;
  authorizeUrl: string;
  userMessage: string;
  canRetry: boolean;

  constructor(
    reason: GoogleAuthErrorReason,
    technicalMessage?: string,
    authorizeUrl?: string,
  ) {
    const { message, userMessage, canRetry } = getErrorMessages(reason);
    super(technicalMessage || message);
    this.name = "GoogleOAuthRequired";
    this.reason = reason;
    this.userMessage = userMessage;
    this.authorizeUrl = authorizeUrl ?? buildAuthorizeUrl();
    this.canRetry = canRetry;
  }

  toJSON(): NeedsGoogleOAuthError {
    return {
      code: this.code,
      reason: this.reason,
      message: this.message,
      userMessage: this.userMessage,
      authorizeUrl: this.authorizeUrl,
      canRetry: this.canRetry,
    };
  }
}

function getErrorMessages(reason: GoogleAuthErrorReason): {
  message: string;
  userMessage: string;
  canRetry: boolean;
} {
  switch (reason) {
    case GoogleAuthErrorReason.NO_ACCOUNT:
      return {
        message: "No Google account connected",
        userMessage: "Please connect your Google account to access Google Analytics features.",
        canRetry: false,
      };
    case GoogleAuthErrorReason.MISSING_SCOPES:
      return {
        message: "Missing required Google Analytics scopes",
        userMessage: "Additional permissions are required. Please reconnect your Google account.",
        canRetry: false,
      };
    case GoogleAuthErrorReason.TOKEN_EXPIRED:
      return {
        message: "Access token expired and no refresh token available",
        userMessage: "Your Google connection has expired. Please reconnect to continue.",
        canRetry: false,
      };
    case GoogleAuthErrorReason.REFRESH_FAILED:
      return {
        message: "Failed to refresh access token",
        userMessage: "Unable to refresh your Google connection. Please reconnect your account.",
        canRetry: false,
      };
    case GoogleAuthErrorReason.TOKEN_REVOKED:
      return {
        message: "Refresh token has been revoked",
        userMessage: "Your Google connection was revoked. Please reconnect to restore access.",
        canRetry: false,
      };
    default:
      return {
        message: "Google authentication required",
        userMessage: "Please connect your Google account to continue.",
        canRetry: false,
      };
  }
}
```

### 2. Update Error Throwing Sites

**File**: `src/server/google/client.ts`

Update all places where `GoogleOAuthRequired` is thrown:

```typescript
// Line ~70: No account found
if (!account) {
  throw new GoogleOAuthRequired(GoogleAuthErrorReason.NO_ACCOUNT);
}

// Line ~80: Missing scopes
if (!hasAllRequiredScopes(account.scope)) {
  throw new GoogleOAuthRequired(GoogleAuthErrorReason.MISSING_SCOPES);
}

// Line ~108: No refresh token
if (needsRefresh && !account.refresh_token) {
  throw new GoogleOAuthRequired(GoogleAuthErrorReason.TOKEN_EXPIRED);
}

// Line ~155: Refresh failed
catch (err) {
  const isRevoked = err?.response?.data?.error === 'invalid_grant';
  const reason = isRevoked
    ? GoogleAuthErrorReason.TOKEN_REVOKED
    : GoogleAuthErrorReason.REFRESH_FAILED;
  throw new GoogleOAuthRequired(reason, err?.message);
}
```

### 3. tRPC Error Serialization Helper

**New File**: `src/server/api/errors.ts`

```typescript
import { TRPCError } from "@trpc/server";
import { GoogleOAuthRequired } from "@/server/google/client";

export type SerializableOAuthError = {
  isOAuthError: true;
  reason: string;
  userMessage: string;
  authorizeUrl: string;
  canRetry: boolean;
};

/**
 * Converts GoogleOAuthRequired errors to tRPC errors with preserved metadata
 */
export function handleGoogleOAuthError(err: GoogleOAuthRequired): never {
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: err.userMessage,
    cause: {
      isOAuthError: true,
      reason: err.reason,
      userMessage: err.userMessage,
      authorizeUrl: err.authorizeUrl,
      canRetry: err.canRetry,
    } satisfies SerializableOAuthError,
  });
}

/**
 * Type guard to check if a tRPC error contains OAuth metadata
 */
export function isOAuthError(
  error: unknown,
): error is { cause: SerializableOAuthError } {
  return (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "isOAuthError" in error.cause &&
    error.cause.isOAuthError === true
  );
}
```

### 4. Update tRPC Router Error Handling

**File**: `src/server/api/routers/google_analytics.ts`

```typescript
import { handleGoogleOAuthError } from "@/server/api/errors";

export const googleAnalyticsRouter = createTRPCRouter({
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    try {
      const accounts = await listAccountsWithPropertiesAndStreams(userId);
      await persistGaAccountsAndPropertiesIfMissing(userId, accounts);
      return accounts;
    } catch (err) {
      // Handle OAuth errors with full metadata preservation
      if (err instanceof GoogleOAuthRequired) {
        handleGoogleOAuthError(err);
      }

      // ... rest of error handling
    }
  }),

  // Add similar handling to other procedures that use Google APIs
});
```

### 5. Frontend Type Definitions

**New File**: `src/types/oauth-errors.ts`

```typescript
export type OAuthErrorData = {
  isOAuthError: true;
  reason: string;
  userMessage: string;
  authorizeUrl: string;
  canRetry: boolean;
};

export function extractOAuthError(error: unknown): OAuthErrorData | null {
  if (
    error &&
    typeof error === "object" &&
    "data" in error &&
    error.data &&
    typeof error.data === "object" &&
    "cause" in error.data &&
    error.data.cause &&
    typeof error.data.cause === "object" &&
    "isOAuthError" in error.data.cause &&
    error.data.cause.isOAuthError === true
  ) {
    return error.data.cause as OAuthErrorData;
  }
  return null;
}
```

## Implementation Steps

1. ✅ Define `GoogleAuthErrorReason` enum
2. ✅ Enhance `GoogleOAuthRequired` class with reason field
3. ✅ Create `getErrorMessages()` helper for user-friendly messages
4. ✅ Update all throw sites in `client.ts` to use specific reasons
5. ✅ Create `errors.ts` helper module for tRPC serialization
6. ✅ Update `google_analytics.ts` router to use error handler
7. ✅ Create frontend type definitions for OAuth errors
8. ✅ Add type guard helpers for error detection

## Testing Scenarios

1. **No Account**: User never connected Google → Shows "Connect Google" message
2. **Missing Scopes**: Old connection without Analytics scope → Shows "Reconnect for permissions"
3. **Token Expired**: Access token expired, no refresh token → Shows "Connection expired"
4. **Refresh Failed**: Network/server error during refresh → Shows "Unable to refresh"
5. **Token Revoked**: User revoked access from Google settings → Shows "Connection revoked"

## Breaking Changes
None - all changes are additive and backward compatible.

## Dependencies
None - uses existing libraries.

## Rollout
Safe to deploy immediately - enhances existing error handling without breaking current functionality.
