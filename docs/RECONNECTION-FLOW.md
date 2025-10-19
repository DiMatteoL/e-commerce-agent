# Google Account Reconnection Flow

## Overview

This document explains how the Google account reconnection flow works and how to debug issues.

## Flow Diagram

```
User Clicks "Reconnect"
         ↓
sessionStorage.setItem("oauth-reconnecting", "true")
         ↓
Redirect to /api/auth/signin?provider=google
         ↓
NextAuth redirects to Google OAuth
         ↓
User approves permissions
         ↓
Google redirects back to NextAuth callback
         ↓
NextAuth processes callback
         ↓
NextAuth signIn callback fires (src/server/auth/config.ts)
    ├─ Check if account exists by providerAccountId
    ├─ If exists: UPDATE existing account with new tokens
    └─ If not exists: Let adapter create new account
         ↓
User returns to callbackUrl (original page)
         ↓
Frontend detects sessionStorage flag
         ↓
Wait 500ms for DB writes to complete
         ↓
Call verifyReconnection endpoint (with retries)
    ├─ Retry #1 (immediate)
    ├─ Retry #2 (after 1s)
    └─ Retry #3 (after 2s)
         ↓
verifyReconnection endpoint (src/server/api/routers/google_analytics.ts)
    ├─ Reconcile duplicate accounts
    ├─ Check connection health
    └─ Return status
         ↓
Invalidate tRPC queries
    ├─ getConnectionStatus
    ├─ getSelectedProperty
    └─ listAccounts
         ↓
UI updates (banner disappears, data refreshes)
```

## Key Files

### Frontend
- **`src/hooks/use-reconnect-google.ts`** - Main reconnection hook with retry logic
- **`src/components/google-connection-banner.tsx`** - Banner UI
- **`src/components/ga4-onboarding-dialog.tsx`** - Dialog UI with reconnection

### Backend
- **`src/server/auth/config.ts`** - NextAuth signIn callback (updates account tokens)
- **`src/server/api/routers/google_analytics.ts`** - verifyReconnection endpoint
- **`src/server/google/reconnect.ts`** - Account reconciliation logic
- **`src/server/google/status.ts`** - Connection health checks
- **`src/server/google/client.ts`** - OAuth client with token refresh

## Timing Issues & Solutions

### Problem: Race Condition

The frontend may query the database before NextAuth has completed writing the updated tokens.

**Symptoms:**
- "Google session expired" error immediately after reconnection
- Works after manual refresh
- Error logs show verification failing but succeeding later

**Solutions Implemented:**

1. **Initial Delay (500ms)**
   ```typescript
   await new Promise(resolve => setTimeout(resolve, 500));
   ```
   Gives NextAuth time to persist account data.

2. **Retry Logic (3 attempts with backoff)**
   ```typescript
   // Try 1: immediate
   // Try 2: after 1s
   // Try 3: after 2s
   ```
   Handles cases where 500ms isn't enough.

3. **Graceful Degradation**
   - Still invalidates queries even if verification fails
   - User can manually retry without code changes

### Problem: Stale Session Cache

The tRPC context might use a cached session that doesn't reflect the updated account.

**Mitigation:**
- Each tRPC request calls `auth()` fresh (no caching)
- NextAuth's `cache()` wrapper ensures same-request deduplication only

## Debugging Guide

### 1. Check Browser Console

Look for these log messages:

**Success Flow:**
```
✓ Updated existing Google account for providerAccountId: xxx
⚠ Reconnection verification attempt 1/3 failed: ...
✓ Reconnection verified: { success: true, ... }
```

**Failure Flow:**
```
✗ Reconnection verification failed after all attempts: ...
```

### 2. Check Server Logs

Look for:
```
[auth][debug]: adapter_getSessionAndUser ...
[TRPC] google_analytics.verifyReconnection took XXXms to execute
✓ Updated existing Google account for providerAccountId: ...
```

### 3. Check Database

Query the `accounts` table:
```sql
SELECT
  provider,
  providerAccountId,
  expires_at,
  access_token IS NOT NULL as has_access_token,
  refresh_token IS NOT NULL as has_refresh_token,
  scope,
  updated_at
FROM accounts
WHERE userId = 'USER_ID' AND provider = 'google';
```

**Expected after reconnection:**
- `expires_at`: ~1 hour from now (UNIX timestamp)
- `has_access_token`: true
- `has_refresh_token`: true
- `scope`: includes "googleapis.com/auth/analytics.readonly"
- `updated_at`: recent timestamp

### 4. Manual Verification

Call the endpoint directly:
```bash
curl -X POST https://your-app.com/api/trpc/google_analytics.verifyReconnection \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 5. Test Connection Status

Check the health endpoint:
```typescript
const status = await api.google_analytics.getConnectionStatus.useQuery();
```

Expected healthy response:
```json
{
  "status": "connected",
  "isHealthy": true,
  "needsReconnection": false,
  "expiresAt": 1234567890,
  "scopes": ["https://www.googleapis.com/auth/analytics.readonly"]
}
```

## Common Issues

### Issue: "Token expired" immediately after reconnection

**Possible Causes:**
1. Google didn't return a refresh_token (user revoked access before reconnecting)
2. Race condition (DB not updated yet)
3. Account reconciliation failed (multiple duplicate accounts)

**Solutions:**
1. Check if `prompt: "consent"` is set in OAuth config (forces new refresh token)
2. Increase initial delay or retry attempts
3. Check for duplicate accounts in DB and manually reconcile

### Issue: Reconnection succeeds but still shows error

**Possible Causes:**
1. Frontend cache not invalidated
2. Different user signed in
3. Scopes changed (missing analytics.readonly)

**Solutions:**
1. Check that invalidate() is called for all relevant queries
2. Verify userId matches between session and account
3. Check account.scope includes required scopes

### Issue: Button does nothing

**Possible Causes:**
1. sessionStorage not being set
2. JavaScript error blocking execution
3. Hook not properly integrated

**Solutions:**
1. Check browser console for errors
2. Verify `useReconnectGoogle` hook is called in component
3. Check that `startReconnection` is passed to button's onClick

## Google OAuth Behavior

### When Google Issues New Refresh Tokens

- **Always**: When `prompt: "consent"` is used
- **Sometimes**: When user hasn't approved recently
- **Never**: If user revokes access (must re-approve)

### Token Expiry

- **Access Token**: ~1 hour (3600 seconds)
- **Refresh Token**: No automatic expiry, but can be revoked by:
  - User in Google account settings
  - Google security measures
  - Too many refresh tokens issued (old ones auto-revoked)

### Recommended: Proactive Refresh

The system includes proactive token refresh:
```typescript
// src/server/google/proactive-refresh.ts
await refreshExpiringTokens(); // Refresh tokens expiring in < 5 min
```

**Set up a cron job:**
```typescript
// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  const result = await refreshExpiringTokens();
  console.log('Token refresh:', result);
});
```

## Testing Checklist

- [ ] Click "Reconnect" in banner → redirects to Google
- [ ] Approve permissions → returns to app
- [ ] Banner disappears automatically
- [ ] GA4 properties load successfully
- [ ] Check console for no errors
- [ ] Test with expired token (manually clear refresh_token in DB)
- [ ] Test with missing scopes (manually update scope in DB)
- [ ] Test with revoked access (revoke in Google account settings)
- [ ] Test reconnection from dialog
- [ ] Test reconnection from settings panel

## Monitoring Recommendations

### Key Metrics

1. **Reconnection Success Rate**
   - Track: `verifyReconnection` success vs failure
   - Alert: < 90% success rate

2. **Token Refresh Failures**
   - Track: `refreshAccessToken` exceptions
   - Alert: > 5% failure rate

3. **Reconnection Latency**
   - Track: Time from OAuth callback to successful verification
   - Alert: > 10 seconds

4. **Retry Patterns**
   - Track: How many retries needed for success
   - Alert: Most requiring 3 attempts (indicates timing issue)

### Log Aggregation

Search for:
```
"✓ Reconnection verified"           - Success
"✗ Reconnection verification failed" - Failure
"⚠ Reconnection verification attempt" - Retry
"invalid_grant"                      - Revoked token
"insufficient_permissions"           - Scope issue
```

## Future Improvements

1. **Session Refresh**: Force NextAuth session refresh after token update
2. **Optimistic UI**: Show "reconnecting" state across all components
3. **Better Error Messages**: Distinguish between temporary and permanent failures
4. **Webhook Support**: Google Cloud Pub/Sub for token revocation notifications
5. **Background Sync**: Periodic token health checks and auto-refresh
