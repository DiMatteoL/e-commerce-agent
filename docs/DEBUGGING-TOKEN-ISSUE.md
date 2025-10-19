# Debugging the "Google session expired" Error After Reconnection

## Problem Statement

After going through the Google OAuth reconnection flow, the `listAccounts` endpoint immediately fails with:
```
tRPC failed on google_analytics.listAccounts: Google session expired or missing permissions. Please reconnect Google and try again.
```

This error occurs despite the user having just successfully reconnected their Google account.

## Root Cause Hypothesis

There are several possible root causes:

### 1. **Race Condition in Token Update** ⚠️ MOST LIKELY
**What happens:**
- User completes OAuth flow → NextAuth receives tokens from Google
- NextAuth `signIn` callback runs and updates account tokens in DB
- Frontend calls `verifyReconnection` → which eventually calls `listAccounts`
- `listAccounts` queries the account table to get tokens
- **IF** the query happens before the UPDATE completes, it gets old expired tokens
- Attempts to use/refresh old tokens → fails with 401

**Evidence needed:**
- Check server logs for timing of `[NextAuth] Updated existing Google account` vs `[OAuth] Token state`
- If `[OAuth]` log shows expired tokens, it means the query happened too soon

**Why the retry might not help:**
- Even with 500ms delay + retries, the DB transaction might not be committed yet
- NextAuth might be running async operations that delay the update

### 2. **Google Not Issuing Refresh Token**
**What happens:**
- User reconnects but Google doesn't return a new `refresh_token`
- This can happen if:
  - User previously approved and revoked multiple times
  - Google's security systems flag the reconnection
  - App isn't using `prompt: "consent"` properly
- The access token is valid for ~1 hour, then expires
- No refresh token available → can't renew

**Evidence needed:**
```sql
SELECT
  refresh_token IS NOT NULL as has_refresh_token,
  expires_at,
  to_timestamp(expires_at) as expires_readable
FROM "Account"
WHERE provider = 'google'
ORDER BY expires_at DESC
LIMIT 1;
```

If `has_refresh_token` is `false`, this is the issue.

### 3. **Wrong Account Being Queried**
**What happens:**
- User has multiple Google accounts in DB (duplicate providerAccountId)
- The signIn callback updates one
- The query selects a different one (e.g., ORDER BY might differ)

**Evidence needed:**
```sql
SELECT COUNT(*) as count, userId
FROM "Account"
WHERE provider = 'google'
GROUP BY userId
HAVING COUNT(*) > 1;
```

If count > 1, there are duplicates.

### 4. **Token Persisted But Invalid**
**What happens:**
- Google returns tokens but they're already invalid
- This can happen if:
  - User's account has security issues
  - Google detects suspicious activity
  - Tokens are for wrong scopes

**Evidence needed:**
- Check the `[NextAuth]` log for the `scope` field
- Verify it includes `https://www.googleapis.com/auth/analytics.readonly`

### 5. **Database Transaction Isolation**
**What happens:**
- The UPDATE runs in one transaction
- The SELECT runs in another transaction before the first commits
- With READ COMMITTED isolation, the SELECT might not see the update yet

**Evidence needed:**
- Check if the signIn callback is wrapped in an explicit transaction
- Check database isolation level: `SHOW TRANSACTION ISOLATION LEVEL;`

## Diagnostic Steps

### Step 1: Check Server Logs

When you trigger reconnection, look for this sequence in the logs:

```
[NextAuth] signIn callback triggered for provider: {providerAccountId}
  userId: xxx
  hasAccessToken: true
  hasRefreshToken: true  ← KEY: Should be true
  expiresAt: {timestamp}
  scope: "openid email profile https://www.googleapis.com/auth/analytics.readonly"

[NextAuth] Found existing account, updating tokens...

✓ [NextAuth] Updated existing Google account for providerAccountId: {id}
  userId: xxx
  expiresAt: {timestamp}
  expiresAtReadable: "2025-10-19T15:30:00.000Z" ← Should be ~1 hour in future

[OAuth] Token state for user {userId}:
  hasAccessToken: true  ← Should be true
  hasRefreshToken: true ← Should be true
  expiresInSeconds: 3600 ← Should be positive (3600 = 1 hour)
  isExpired: false ← Should be false
  hasRequiredScopes: true ← Should be true
  expiresAtReadable: "2025-10-19T15:30:00.000Z"
```

**🚨 Red Flags:**
- `hasRefreshToken: false` in either log
- `isExpired: true` in the `[OAuth]` log
- `expiresInSeconds: -XXX` (negative number)
- `hasRequiredScopes: false`
- `[OAuth]` log appears BEFORE `[NextAuth]` update log

### Step 2: Check Database State

Run the diagnostic SQL script:
```bash
psql your_database < scripts/debug-token-state.sql
```

Or manually query:
```sql
SELECT
  provider,
  providerAccountId,

  -- Token Status
  CASE
    WHEN access_token IS NULL THEN '❌ NULL'
    WHEN LENGTH(access_token) < 10 THEN '⚠️  SHORT'
    ELSE '✓ OK'
  END as access_token_status,

  CASE
    WHEN refresh_token IS NULL THEN '❌ NULL'
    WHEN LENGTH(refresh_token) < 10 THEN '⚠️  SHORT'
    ELSE '✓ OK'
  END as refresh_token_status,

  -- Expiry Info
  expires_at,
  to_timestamp(expires_at) as expires_at_readable,
  CASE
    WHEN expires_at IS NULL THEN '❌ NULL'
    WHEN to_timestamp(expires_at) < NOW() THEN '❌ EXPIRED'
    WHEN to_timestamp(expires_at) < NOW() + INTERVAL '5 minutes' THEN '⚠️  EXPIRING SOON'
    ELSE '✓ VALID'
  END as expiry_status,

  -- Scope
  CASE
    WHEN scope LIKE '%analytics.readonly%' THEN '✓ HAS ANALYTICS'
    ELSE '❌ MISSING'
  END as scope_status

FROM "Account"
WHERE provider = 'google'
ORDER BY expires_at DESC
LIMIT 1;
```

**Expected after successful reconnection:**
- `access_token_status`: `✓ OK`
- `refresh_token_status`: `✓ OK`
- `expiry_status`: `✓ VALID`
- `scope_status`: `✓ HAS ANALYTICS`

### Step 3: Test Token Manually

You can test the tokens directly against Google's API:

```bash
# Get the access token from DB (expires_at should be in future)
ACCESS_TOKEN="your_access_token_from_db"

# Test against Google Analytics API
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://analyticsadmin.googleapis.com/v1beta/accountSummaries"
```

**Expected responses:**
- `200 OK` with account data → Token is valid
- `401 Unauthorized` → Token is invalid/expired
- `403 Forbidden` → Token is valid but missing scopes

### Step 4: Check Timing

Add timestamps to understand the timing:

```javascript
// In browser console after reconnection:
console.log("User returned at:", new Date().toISOString());
```

Then look for the server logs and note the timestamps. The sequence should be:
1. User returns (browser log)
2. NextAuth signIn callback runs (within 100ms)
3. Frontend waits 500ms
4. Frontend calls verifyReconnection (500ms after return)
5. getGoogleOAuthClientForUser queries DB

If step 5 happens before step 2 completes, that's the race condition.

## Solutions Based on Root Cause

### If Root Cause is #1 (Race Condition):

**Solution A: Increase Retry Delay**
```typescript
// In use-reconnect-google.ts
await new Promise((resolve) => setTimeout(resolve, 1500)); // Increase from 500ms
```

**Solution B: Add Explicit Sync Point**
Create a new endpoint that blocks until the account update is confirmed:
```typescript
// src/server/api/routers/google_analytics.ts
waitForAccountUpdate: protectedProcedure.mutation(async ({ ctx }) => {
  const userId = ctx.session.user.id;
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    const [account] = await db.select().from(accounts)
      .where(and(
        eq(accounts.userId, userId),
        eq(accounts.provider, "google")
      ));

    const now = Math.floor(Date.now() / 1000);
    const isValid = account?.expires_at && account.expires_at > now;

    if (isValid) {
      return { ready: true };
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new TRPCError({ code: "TIMEOUT", message: "Account update timed out" });
});
```

**Solution C: Use Database Trigger/Notification**
Set up PostgreSQL NOTIFY/LISTEN to signal when account is updated.

### If Root Cause is #2 (No Refresh Token):

**Solution: Force prompt=consent always**
```typescript
// src/server/auth/config.ts
authorization: {
  params: {
    access_type: "offline",
    prompt: "consent",  // Already set ✓
    scope: [...].join(" "),
  },
},
```

If already set, the issue might be Google-side. Users may need to:
1. Revoke app access in Google account settings
2. Wait 24 hours
3. Reconnect (Google will issue new refresh token)

### If Root Cause is #3 (Duplicate Accounts):

**Solution: Force reconciliation before any query**
```typescript
// src/server/google/client.ts
export async function getGoogleOAuthClientForUser(userId: string) {
  // ALWAYS reconcile first
  await reconcileGoogleAccount(userId);

  // Then query
  const [account] = await db.select()...
}
```

### If Root Cause is #4 (Invalid Tokens):

**Solution: Add token validation**
```typescript
// After getting tokens, test them immediately
const testRequest = await oauth2.request({
  url: 'https://www.googleapis.com/oauth2/v1/tokeninfo',
});

if (testRequest.status !== 200) {
  throw new GoogleOAuthRequired(GoogleAuthErrorReason.TOKEN_REVOKED);
}
```

### If Root Cause is #5 (Transaction Isolation):

**Solution: Add explicit transaction with serializable isolation**
```typescript
// src/server/auth/config.ts
await db.transaction(async (tx) => {
  await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);

  const existing = await tx.select()...
  await tx.update(accounts)...
}, {
  isolationLevel: 'serializable'
});
```

## Immediate Action Items

1. **Try reconnection again** and watch server logs for the sequence above
2. **Run the SQL diagnostic** immediately after reconnection
3. **Share the logs** here:
   - `[NextAuth]` log entries
   - `[OAuth]` log entries
   - SQL diagnostic results
   - Browser console timing

4. **Time the operations:**
   - Note the exact timestamp when you return from Google
   - Note when the error appears
   - Calculate the delta

## Expected Timeline

With current implementation:
- `t=0ms`: User returns from OAuth
- `t=0-200ms`: NextAuth processes callback, runs signIn callback
- `t=500ms`: Frontend starts verification
- `t=500-1000ms`: First verification attempt
- `t=1500-2000ms`: Second verification attempt (if first fails)
- `t=3500-4000ms`: Third verification attempt (if second fails)

If all three attempts fail, the account update is taking > 4 seconds, which suggests:
- Database connection pool exhaustion
- Lock contention
- Slow transaction commit
- Or Google never issued valid tokens to begin with

## Next Steps

Please trigger a reconnection now with the enhanced logging and share:

1. Complete server log output (from OAuth redirect to error)
2. Result of SQL diagnostic query
3. Timing from browser console

This will definitively tell us which root cause we're dealing with. 🔍
