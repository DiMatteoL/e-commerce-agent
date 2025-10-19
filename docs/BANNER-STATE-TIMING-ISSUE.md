# Banner State Timing Issue

## Problem Description

User reported that with a month-old token on the distriwear account:
1. Banner initially showed **warning state** ("Your Google connection will expire soon")
2. User experienced API errors (401)
3. After page refresh, banner changed to **error state**

## Root Cause Analysis

### Issue 1: Status Check Logic

The `checkGoogleConnectionHealth()` function had correct logic BUT didn't handle the case where access tokens naturally expire every hour.

**Original behavior:**
- If token expired AND has refresh_token → Falls through to "expiring_soon" check
- Shows warning instead of treating it as normal

**Fixed behavior:**
```typescript
// Token expired but has refresh token - this is NORMAL
if (expiryMs && expiryMs < nowMs && account.refresh_token) {
  return {
    status: "connected",  // Still connected - refresh token is valid
    isHealthy: true,      // Can auto-refresh, so still healthy
    needsReconnection: false,
  };
}
```

**Key insight:** Access tokens expire every hour. This is expected behavior when you have a refresh token. The connection is still healthy because it will auto-refresh on next API call.

### Issue 2: Status Cache Not Invalidated on Error

When an API call failed due to authentication:
1. The error occurred (refresh token might be revoked)
2. BUT the connection status was cached for 5 minutes
3. Banner still showed old "healthy" state
4. User had to refresh manually to see error

**The fix:**
```typescript
// In listAccounts error handler:
if (err instanceof GoogleOAuthRequired) {
  // When refresh actually fails, mark account as revoked
  if (err.reason === GoogleAuthErrorReason.TOKEN_REVOKED ||
      err.reason === GoogleAuthErrorReason.REFRESH_FAILED) {
    await markAccountAsRevoked(userId); // Clears refresh_token
  }
  handleGoogleOAuthError(err);
}
```

This ensures:
- When refresh fails, we immediately clear the refresh_token in DB
- Next status check will see no refresh_token → returns "expired" status
- Frontend's `refetchInterval` (5 minutes) will pick it up
- Banner updates to error state

## Timeline of Events (What Happened)

### Before Fix

```
t=0:  User loads page
      Status check: "Token expired but has refresh_token" → "expiring_soon" ⚠️
      Banner: Warning state

t=5s: User clicks "List Accounts"
      API call attempts to use expired token
      Token refresh attempted
      Refresh FAILS (token revoked or network issue)
      Error returned to user

      BUT: refresh_token still in database
      Status cache: Still says "expiring_soon" (cached for 5 min)
      Banner: Still showing warning ⚠️

t=60s: User refreshes page
       Status check: Still sees refresh_token
       Banner: Still warning ⚠️
```

### After Fix

```
t=0:  User loads page
      Status check: "Token expired but has refresh_token" → "connected" ✓
      Banner: No banner (connection is healthy, will auto-refresh)

t=5s: User clicks "List Accounts"
      API call attempts to use expired token
      Token refresh attempted
      Refresh FAILS
      markAccountAsRevoked() → Clears refresh_token from DB
      Error returned to user

t=6s: Frontend refetch (triggered by error or interval)
      Status check: No refresh_token found → "expired" ❌
      Banner: Error state with "Reconnect" button
```

## Files Modified

1. **`src/server/google/status.ts`**
   - Added logic to treat expired access token + valid refresh token as "connected"
   - This prevents false "expiring_soon" warnings for normal hourly expirations

2. **`src/server/api/routers/google_analytics.ts`**
   - Added `markAccountAsRevoked()` call when refresh fails
   - Ensures connection status reflects reality immediately after auth failure

## Testing

### Test Case 1: Normal Token Expiry
```bash
# 1. Get a user with valid refresh_token but expired access_token
# 2. Call getConnectionStatus
# Expected: status="connected", isHealthy=true

# 3. Call listAccounts
# Expected: Auto-refreshes and succeeds
```

### Test Case 2: Revoked Refresh Token
```bash
# 1. User has expired access_token and (secretly revoked) refresh_token
# 2. Call getConnectionStatus
# Expected: status="connected", isHealthy=true (looks good in DB)

# 3. Call listAccounts
# Expected: Refresh fails, markAccountAsRevoked called, returns 401

# 4. Call getConnectionStatus again
# Expected: status="expired", isHealthy=false, needsReconnection=true
```

### Test Case 3: Token Expiring Soon
```bash
# 1. User has token expiring within 7 days
# 2. Call getConnectionStatus
# Expected: status="expiring_soon", isHealthy=true, warningMessage set
```

## Cache Behavior

### Frontend Query Cache

```typescript
// src/hooks/use-google-connection-status.ts
api.google_analytics.getConnectionStatus.useQuery(undefined, {
  refetchOnWindowFocus: true,
  refetchInterval: 5 * 60 * 1000, // 5 minutes
});
```

**Implications:**
- Status updates automatically every 5 minutes
- Also updates when user switches back to tab
- Manual refetch available via returned `refetch()` function

### Improving Real-Time Updates

Future enhancement: Invalidate cache when ANY API error occurs

```typescript
// In error handlers:
if (err instanceof GoogleOAuthRequired) {
  // Trigger immediate status refresh
  await utils.google_analytics.getConnectionStatus.invalidate();
}
```

This would update the banner immediately without waiting for the next poll.

## Related Docs

- `/docs/RECONNECTION-FLOW.md` - Overall reconnection system
- `/docs/GOOGLEAPIS-AUTH-WORKAROUND.md` - Why we use explicit headers
- `/docs/DEBUGGING-TOKEN-ISSUE.md` - Full debugging process

## Date

Fixed: October 19, 2025
