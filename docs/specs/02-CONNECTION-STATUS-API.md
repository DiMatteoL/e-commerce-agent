# Spec 02: Google Account Connection Status API

## Objective
Create tRPC endpoints to check Google account connection health, enabling proactive detection of auth issues before they cause errors.

## Current State
- No way to check connection status without making an API call
- Users only discover auth issues when GA4 tools fail
- No proactive warnings about token expiration

## Proposed Changes

### 1. Connection Status Types

**New File**: `src/server/google/status.ts`

```typescript
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { GoogleAuthErrorReason } from "./client";

const GOOGLE_PROVIDER_ID = "google" as const;
const TOKEN_WARNING_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
] as const;

export type ConnectionStatus =
  | "connected"
  | "expired"
  | "expiring_soon"
  | "missing_scopes"
  | "not_connected"
  | "revoked";

export type GoogleConnectionHealth = {
  status: ConnectionStatus;
  isHealthy: boolean;
  needsReconnection: boolean;
  warningMessage?: string;
  errorReason?: GoogleAuthErrorReason;
  expiresAt?: number; // Unix timestamp in seconds
  scopes?: string[];
  connectedAt?: Date;
};

/**
 * Check Google account connection health without making API calls
 */
export async function checkGoogleConnectionHealth(
  userId: string,
): Promise<GoogleConnectionHealth> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, GOOGLE_PROVIDER_ID),
      ),
    );

  // No account connected
  if (!account) {
    return {
      status: "not_connected",
      isHealthy: false,
      needsReconnection: true,
      errorReason: GoogleAuthErrorReason.NO_ACCOUNT,
    };
  }

  // Check scopes
  const hasAllScopes = hasRequiredScopes(account.scope);
  if (!hasAllScopes) {
    return {
      status: "missing_scopes",
      isHealthy: false,
      needsReconnection: true,
      warningMessage: "Missing Google Analytics permissions",
      errorReason: GoogleAuthErrorReason.MISSING_SCOPES,
      scopes: account.scope?.split(" ") ?? [],
    };
  }

  // Check token expiration
  const nowMs = Date.now();
  const expiresAt = account.expires_at;
  const expiryMs = expiresAt ? expiresAt * 1000 : 0;

  // Token expired and no refresh token
  if (expiryMs && expiryMs < nowMs && !account.refresh_token) {
    return {
      status: "expired",
      isHealthy: false,
      needsReconnection: true,
      warningMessage: "Your Google connection has expired",
      errorReason: GoogleAuthErrorReason.TOKEN_EXPIRED,
      expiresAt,
    };
  }

  // Token expiring soon
  if (expiryMs && expiryMs - nowMs < TOKEN_WARNING_THRESHOLD_MS) {
    return {
      status: "expiring_soon",
      isHealthy: true,
      needsReconnection: false,
      warningMessage: "Your Google connection will expire soon",
      expiresAt,
      scopes: account.scope?.split(" ") ?? [],
    };
  }

  // All good
  return {
    status: "connected",
    isHealthy: true,
    needsReconnection: false,
    expiresAt,
    scopes: account.scope?.split(" ") ?? [],
  };
}

function hasRequiredScopes(scope?: string | null): boolean {
  if (!scope) return false;
  const granted = new Set(scope.split(/\s+/).filter(Boolean));
  return REQUIRED_SCOPES.every((s) => granted.has(s));
}

/**
 * Mark account as potentially revoked (for when refresh fails)
 * This could be stored in a new column if needed, but for now
 * we can infer it from refresh failures
 */
export async function markAccountAsRevoked(userId: string): Promise<void> {
  // Future: add a 'revoked' flag to the accounts table
  // For now, we'll handle this through error detection
  // Could also delete the refresh_token to force reconnection
  await db
    .update(accounts)
    .set({ refresh_token: null })
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, GOOGLE_PROVIDER_ID),
      ),
    );
}
```

### 2. tRPC Endpoints

**File**: `src/server/api/routers/google_analytics.ts`

Add new procedures:

```typescript
import { checkGoogleConnectionHealth } from "@/server/google/status";

export const googleAnalyticsRouter = createTRPCRouter({
  // ... existing procedures

  /**
   * Check Google account connection health
   * Returns status without making external API calls
   */
  getConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const health = await checkGoogleConnectionHealth(userId);
    return health;
  }),

  /**
   * Test Google connection by making a lightweight API call
   * This actually validates that the credentials work
   */
  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    try {
      // Try to get the OAuth client - this will attempt token refresh if needed
      const client = await getGoogleOAuthClientForUser(userId);

      // Make a lightweight API call to verify credentials
      const analyticsAdmin = new analyticsadmin_v1beta.Analyticsadmin({
        auth: client
      });

      // List account summaries is a lightweight call
      await analyticsAdmin.accountSummaries.list({ pageSize: 1 });

      return {
        success: true,
        message: "Google connection is working",
      };
    } catch (err) {
      if (err instanceof GoogleOAuthRequired) {
        handleGoogleOAuthError(err);
      }

      return {
        success: false,
        message: err instanceof Error ? err.message : "Connection test failed",
      };
    }
  }),

  /**
   * Force disconnect Google account
   * Useful for testing and user-initiated disconnection
   */
  disconnectGoogle: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    await db
      .delete(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.provider, "google"),
        ),
      );

    return { success: true };
  }),
});
```

### 3. React Hooks for Connection Status

**New File**: `src/hooks/use-google-connection-status.ts`

```typescript
import { api } from "@/trpc/react";
import { useEffect, useState } from "react";

export function useGoogleConnectionStatus() {
  const { data, isLoading, error, refetch } =
    api.google_analytics.getConnectionStatus.useQuery(undefined, {
      refetchOnWindowFocus: true,
      refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
    });

  return {
    status: data?.status ?? "not_connected",
    isHealthy: data?.isHealthy ?? false,
    needsReconnection: data?.needsReconnection ?? false,
    warningMessage: data?.warningMessage,
    errorReason: data?.errorReason,
    isLoading,
    error,
    refetch,
  };
}

export function useTestGoogleConnection() {
  const [testing, setTesting] = useState(false);
  const testMutation = api.google_analytics.testConnection.useMutation();

  const testConnection = async () => {
    setTesting(true);
    try {
      const result = await testMutation.mutateAsync();
      return result;
    } finally {
      setTesting(false);
    }
  };

  return {
    testConnection,
    testing,
    result: testMutation.data,
    error: testMutation.error,
  };
}
```

### 4. Database Schema Updates (Optional but Recommended)

**File**: `src/server/db/schema.ts`

Add optional tracking fields to accounts table:

```typescript
// Note: This is OPTIONAL - the core functionality works without it
// But it provides better tracking and debugging

export const accounts = createTable(
  "account",
  (d) => ({
    // ... existing fields

    // Optional: Track last successful refresh
    lastRefreshedAt: d.timestamp({ withTimezone: true }),

    // Optional: Track refresh failures
    refreshFailureCount: d.integer().default(0),
    lastRefreshError: d.text(),

    // Optional: Track revocation
    revokedAt: d.timestamp({ withTimezone: true }),
  }),
  // ... indexes
);
```

If adding these fields, create a migration:

```bash
npm run db:generate
npm run db:migrate
```

Then update `client.ts` to record refresh metadata:

```typescript
// In refreshAccessToken success block (line ~143)
await db
  .update(accounts)
  .set({
    access_token: newAccessToken,
    refresh_token: newRefreshToken ?? undefined,
    id_token: newIdToken,
    scope: newScope,
    token_type: newTokenType,
    expires_at: newExpiresAt ?? undefined,
    lastRefreshedAt: new Date(), // NEW
    refreshFailureCount: 0, // NEW - reset on success
    lastRefreshError: null, // NEW - clear error
  })
  .where(/* ... */);

// In refreshAccessToken catch block (line ~155)
await db
  .update(accounts)
  .set({
    refreshFailureCount: sql`${accounts.refreshFailureCount} + 1`,
    lastRefreshError: err?.message ?? "Unknown error",
  })
  .where(/* ... */);
```

## Implementation Steps

1. ✅ Create `status.ts` module with health check logic
2. ✅ Add tRPC endpoints: `getConnectionStatus`, `testConnection`, `disconnectGoogle`
3. ✅ Create React hooks for consuming status API
4. ⚠️ (Optional) Add schema tracking fields
5. ⚠️ (Optional) Generate and run migration
6. ⚠️ (Optional) Update refresh logic to record metadata

## Usage Examples

### In a Component

```typescript
function MyComponent() {
  const {
    status,
    isHealthy,
    needsReconnection,
    warningMessage
  } = useGoogleConnectionStatus();

  if (needsReconnection) {
    return <ReconnectionBanner message={warningMessage} />;
  }

  if (status === "expiring_soon") {
    return <WarningBanner message={warningMessage} />;
  }

  return <NormalContent />;
}
```

### Manual Testing

```typescript
function ConnectionTest() {
  const { testConnection, testing } = useTestGoogleConnection();

  return (
    <button onClick={testConnection} disabled={testing}>
      {testing ? "Testing..." : "Test Connection"}
    </button>
  );
}
```

## Testing Scenarios

1. **New User**: No account → status = "not_connected"
2. **Connected User**: Valid tokens → status = "connected"
3. **Expired Token (with refresh)**: Should still show "connected"
4. **Expired Token (no refresh)**: status = "expired"
5. **Missing Scopes**: status = "missing_scopes"
6. **Token Expiring**: status = "expiring_soon" (7 days before)

## Performance Considerations

- ✅ Health check only queries database (no external API calls)
- ✅ Uses query cache with 5-minute invalidation
- ✅ Lightweight and can run frequently
- ⚠️ Consider rate limiting test connection endpoint

## Security Considerations

- ✅ All endpoints protected by `protectedProcedure`
- ✅ Users can only check their own connection status
- ✅ Sensitive token data never exposed to frontend

## Breaking Changes
None - all additions are backward compatible.

## Dependencies
None - uses existing libraries.
