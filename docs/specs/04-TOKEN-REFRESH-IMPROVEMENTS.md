# Spec 04: Token Refresh Improvements

## Objective
Enhance the token refresh mechanism to better handle failures, provide detailed error information, and gracefully degrade when refresh tokens become invalid.

## Current State
- Basic refresh logic exists in `getGoogleOAuthClientForUser()`
- Generic error handling on refresh failure
- No distinction between different failure types
- Refresh failures require database deletion to recover

## Proposed Changes

### 1. Enhanced Refresh Error Detection

**File**: `src/server/google/client.ts`

Update the refresh logic with better error detection:

```typescript
if (needsRefresh && account.refresh_token) {
  try {
    const { credentials } = await oauth2.refreshAccessToken();

    // Persist updated tokens
    const newAccessToken = credentials.access_token ?? null;
    const newIdToken = credentials.id_token ?? null;
    const newScope = credentials.scope ?? null;
    const newTokenType = credentials.token_type ?? null;
    const newExpiresAt = credentials.expiry_date
      ? Math.floor(credentials.expiry_date / 1000)
      : null;
    // Google MAY return a new refresh token; if so, use it
    const newRefreshToken = credentials.refresh_token ?? account.refresh_token;

    await db
      .update(accounts)
      .set({
        access_token: newAccessToken,
        refresh_token: newRefreshToken ?? undefined,
        id_token: newIdToken,
        scope: newScope,
        token_type: newTokenType,
        expires_at: newExpiresAt ?? undefined,
        // Optional tracking fields (if schema updated per Spec 02)
        lastRefreshedAt: new Date(),
        refreshFailureCount: 0,
        lastRefreshError: null,
      })
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.provider, GOOGLE_PROVIDER_ID),
        ),
      );

    // Update local credentials so returned client is ready
    oauth2.setCredentials({
      access_token: credentials.access_token,
      refresh_token: newRefreshToken ?? undefined,
      id_token: credentials.id_token,
      scope: credentials.scope,
      token_type: credentials.token_type,
      expiry_date: credentials.expiry_date,
    });

    console.log(`✓ Successfully refreshed tokens for user ${userId}`);
  } catch (err: any) {
    // Detailed error classification
    const errorCode = err?.response?.data?.error;
    const errorDescription = err?.response?.data?.error_description;
    const statusCode = err?.response?.status;

    console.error("Token refresh failed:", {
      errorCode,
      errorDescription,
      statusCode,
      userId,
    });

    // Optional: Record failure (if schema updated)
    try {
      await db
        .update(accounts)
        .set({
          refreshFailureCount: sql`COALESCE(${accounts.refreshFailureCount}, 0) + 1`,
          lastRefreshError: errorCode ?? "unknown_error",
        })
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.provider, GOOGLE_PROVIDER_ID),
          ),
        );
    } catch (dbErr) {
      // Ignore DB error - don't want to mask the auth error
      console.error("Failed to record refresh error:", dbErr);
    }

    // Classify error type
    if (errorCode === "invalid_grant") {
      // Most common: user revoked access, token expired, or security event
      // Clear the refresh token since it's no longer valid
      await db
        .update(accounts)
        .set({
          refresh_token: null,
          revokedAt: new Date(), // Optional field
        })
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.provider, GOOGLE_PROVIDER_ID),
          ),
        );

      throw new GoogleOAuthRequired(
        GoogleAuthErrorReason.TOKEN_REVOKED,
        errorDescription ?? "Refresh token is no longer valid",
      );
    }

    if (errorCode === "invalid_client") {
      // Client credentials (app keys) are wrong
      console.error("CRITICAL: Invalid OAuth client credentials");
      throw new GoogleOAuthRequired(
        GoogleAuthErrorReason.REFRESH_FAILED,
        "OAuth client configuration error",
      );
    }

    if (statusCode === 401 || statusCode === 403) {
      // Unauthorized or forbidden
      throw new GoogleOAuthRequired(
        GoogleAuthErrorReason.REFRESH_FAILED,
        errorDescription ?? "Token refresh unauthorized",
      );
    }

    if (statusCode >= 500) {
      // Google server error - might be temporary
      throw new GoogleOAuthRequired(
        GoogleAuthErrorReason.REFRESH_FAILED,
        "Google server error. Please try again later.",
      );
    }

    // Unknown error
    throw new GoogleOAuthRequired(
      GoogleAuthErrorReason.REFRESH_FAILED,
      errorDescription ?? "Failed to refresh access token",
    );
  }
}
```

### 2. Retry Logic with Exponential Backoff

**File**: `src/server/google/client.ts`

Add retry logic for transient failures:

```typescript
async function refreshAccessTokenWithRetry(
  oauth2: OAuth2Client,
  maxRetries = 3,
): Promise<Credentials> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      return credentials;
    } catch (err: any) {
      lastError = err;
      const errorCode = err?.response?.data?.error;
      const statusCode = err?.response?.status;

      // Don't retry on permanent failures
      if (
        errorCode === "invalid_grant" ||
        errorCode === "invalid_client" ||
        statusCode === 401 ||
        statusCode === 403
      ) {
        throw err;
      }

      // Retry on server errors or network issues
      if (statusCode >= 500 || !statusCode) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Unknown error - don't retry
      throw err;
    }
  }

  throw lastError ?? new Error("Token refresh failed after retries");
}

// Update the refresh block to use retry logic:
if (needsRefresh && account.refresh_token) {
  try {
    const credentials = await refreshAccessTokenWithRetry(oauth2);
    // ... rest of the success handling
  } catch (err) {
    // ... error handling
  }
}
```

### 3. Proactive Token Refresh

**New File**: `src/server/google/proactive-refresh.ts`

Background job to refresh tokens before they expire:

```typescript
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { eq, and, lt, gt } from "drizzle-orm";
import { getGoogleOAuthClientForUser } from "./client";

const GOOGLE_PROVIDER_ID = "google" as const;
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry

/**
 * Proactively refresh tokens that are about to expire
 * Can be called from a cron job or background worker
 */
export async function refreshExpiringTokens(): Promise<{
  refreshed: number;
  failed: number;
  skipped: number;
}> {
  const nowTimestamp = Math.floor(Date.now() / 1000);
  const thresholdTimestamp = Math.floor(
    (Date.now() + REFRESH_THRESHOLD_MS) / 1000,
  );

  // Find accounts with tokens expiring soon
  const expiringAccounts = await db
    .select({
      userId: accounts.userId,
      expires_at: accounts.expires_at,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.provider, GOOGLE_PROVIDER_ID),
        gt(accounts.expires_at, nowTimestamp), // Not yet expired
        lt(accounts.expires_at, thresholdTimestamp), // Expiring soon
        // Has refresh token
        // Note: This is a simple check; adjust based on your needs
      ),
    );

  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  for (const account of expiringAccounts) {
    try {
      // This will trigger refresh if needed
      await getGoogleOAuthClientForUser(account.userId);
      refreshed++;
      console.log(`✓ Proactively refreshed tokens for user ${account.userId}`);
    } catch (err) {
      failed++;
      console.error(
        `✗ Failed to proactively refresh for user ${account.userId}:`,
        err,
      );
    }
  }

  return { refreshed, failed, skipped };
}

/**
 * Example cron job setup (if using Vercel Cron, etc.)
 */
export async function GET() {
  // Protect with auth or secret key
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await refreshExpiringTokens();
  return Response.json(result);
}
```

### 4. Token Refresh Status Tracking

**File**: `src/server/google/status.ts`

Add function to check if refresh is needed:

```typescript
export type TokenRefreshStatus = {
  needsRefresh: boolean;
  reason?: "expired" | "expiring_soon" | "no_token";
  expiresAt?: number;
  expiresIn?: number; // milliseconds
};

export async function checkTokenRefreshStatus(
  userId: string,
): Promise<TokenRefreshStatus> {
  const [account] = await db
    .select({
      access_token: accounts.access_token,
      expires_at: accounts.expires_at,
      refresh_token: accounts.refresh_token,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, "google"),
      ),
    );

  if (!account) {
    return {
      needsRefresh: true,
      reason: "no_token",
    };
  }

  const nowMs = Date.now();
  const expiresAt = account.expires_at;
  const expiryMs = expiresAt ? expiresAt * 1000 : 0;
  const expiresIn = expiryMs - nowMs;

  // No access token
  if (!account.access_token) {
    return {
      needsRefresh: true,
      reason: "no_token",
      expiresAt,
    };
  }

  // Already expired
  if (expiryMs && expiryMs < nowMs) {
    return {
      needsRefresh: true,
      reason: "expired",
      expiresAt,
      expiresIn,
    };
  }

  // Expiring soon (within 5 minutes)
  if (expiresIn < 5 * 60 * 1000) {
    return {
      needsRefresh: true,
      reason: "expiring_soon",
      expiresAt,
      expiresIn,
    };
  }

  return {
    needsRefresh: false,
    expiresAt,
    expiresIn,
  };
}
```

### 5. Refresh Monitoring Dashboard (Optional)

**New File**: `src/app/api/admin/token-health/route.ts`

Admin endpoint to monitor token health across all users:

```typescript
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { eq, and, lt, isNotNull } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // Protect with admin auth
  // ... auth check

  const nowTimestamp = Math.floor(Date.now() / 1000);

  const stats = await db
    .select({
      total: sql<number>`count(*)`,
      expired: sql<number>`count(*) filter (where ${accounts.expires_at} < ${nowTimestamp})`,
      expiringSoon: sql<number>`count(*) filter (where ${accounts.expires_at} < ${nowTimestamp + 86400})`,
      hasRefreshToken: sql<number>`count(*) filter (where ${accounts.refresh_token} is not null)`,
    })
    .from(accounts)
    .where(eq(accounts.provider, "google"));

  return Response.json({
    timestamp: new Date().toISOString(),
    google_accounts: stats[0],
  });
}
```

## Implementation Steps

1. ✅ Update refresh error detection with detailed classification
2. ✅ Add retry logic with exponential backoff
3. ✅ Implement proactive refresh function
4. ✅ Add token refresh status checking
5. ⚠️ (Optional) Create monitoring dashboard
6. ⚠️ (Optional) Set up cron job for proactive refresh
7. ✅ Update error messages for user clarity
8. ✅ Add logging for debugging

## Testing Scenarios

### Test Case 1: Successful Refresh
1. Token expired, valid refresh token
2. Refresh succeeds on first try
3. New tokens stored
4. ✅ User continues working

### Test Case 2: Invalid Grant
1. User revoked access
2. Refresh fails with `invalid_grant`
3. Refresh token cleared from DB
4. User sees reconnection prompt
5. ✅ User reconnects successfully

### Test Case 3: Transient Failure
1. Google returns 500 error
2. Retry logic attempts 3 times
3. Succeeds on retry
4. ✅ User unaware of issue

### Test Case 4: Permanent Failure
1. Refresh token truly invalid
2. All retries fail
3. Token marked as revoked
4. Clear error shown to user
5. ✅ User reconnects

### Test Case 5: Proactive Refresh
1. Token expires in 4 minutes
2. Background job runs
3. Token refreshed before expiry
4. ✅ User never sees error

## Performance Considerations

- ✅ Retry delays are reasonable (1s, 2s, 4s max)
- ✅ Only retry on transient errors
- ✅ Proactive refresh runs in background
- ⚠️ Monitor database load from refresh tracking

## Security Considerations

- ✅ Failed tokens are cleared (not left in invalid state)
- ✅ Detailed errors logged for debugging but not exposed to users
- ✅ Admin dashboard protected by auth
- ✅ Refresh token never sent to frontend

## Breaking Changes
None - all enhancements to existing logic.

## Dependencies
None - uses existing libraries.

## Rollout Plan

1. Deploy enhanced error detection first
2. Monitor error types and frequencies
3. Deploy retry logic
4. Test proactive refresh in staging
5. Enable proactive refresh in production
6. Monitor success rates

## Success Metrics

- < 1% permanent refresh failures
- > 90% success rate on first retry
- Zero unexpected token expiration errors
- Proactive refresh prevents 95% of user-facing errors

## Monitoring & Alerts

Set up alerts for:
- High refresh failure rate (> 5%)
- Multiple `invalid_grant` errors (possible security issue)
- No successful refreshes in 24h (possible system issue)
- Spike in reconnection requests
