# Removing "Expiring Soon" Warning Banner

## Change Summary

**Removed the "expiring soon" warning state** from the connection status system. Users will now only see banners when there's an **actual error** requiring action, not preventive warnings.

## Rationale

1. **Access tokens expire every hour** - this is normal OAuth behavior
2. **System auto-refreshes** - users don't need to take action
3. **Refresh tokens last months/years** - no need for "7 days left" warnings
4. **Reduced notification fatigue** - only show banners when something is actually broken

## What Users See Now

### ✅ No Banner (Everything Works)
- Token is valid
- Token expired but has valid refresh token (auto-refreshes on next API call)
- System is healthy

### ❌ Error Banner (Action Required)
- Token expired AND no refresh token available
- Refresh token revoked by user
- Token refresh failed (after retries)
- Missing required scopes

## Files Modified

### 1. `src/server/google/status.ts`
**Before:**
```typescript
// Token expiring soon (within 7 days)
if (expiryMs && expiryMs - nowMs < TOKEN_WARNING_THRESHOLD_MS) {
  return {
    status: "expiring_soon",
    isHealthy: true,
    needsReconnection: false,
    warningMessage: "Your Google connection will expire soon",
  };
}
```

**After:**
```typescript
// NOTE: We removed "expiring_soon" warning state
// Users don't need to see warnings as long as auto-refresh works
// Only show errors when refresh actually fails

// All good - token is valid and we can refresh
return {
  status: "connected",
  isHealthy: true,
  needsReconnection: false,
};
```

### 2. `src/components/google-connection-banner.tsx`

**Removed:**
- "warning" variant styling
- AlertTriangle icon for expiring_soon state
- Conditional rendering for expiring_soon status

**Result:** Banner only shows for `needsReconnection: true` states.

## Connection States Now

| Scenario | Status | isHealthy | Banner | Auto-Refresh |
|----------|--------|-----------|--------|--------------|
| Fresh valid token | `connected` | ✅ | None | N/A |
| Token expired + has refresh_token | `connected` | ✅ | None | ✅ Yes |
| Token expired + NO refresh_token | `expired` | ❌ | Error | ❌ No |
| Refresh token revoked | `expired` | ❌ | Error | ❌ No |
| Missing scopes | `missing_scopes` | ❌ | Error | ❌ No |
| No account | `not_connected` | ❌ | Error | ❌ No |

## Benefits

1. **Better UX** - Users only see alerts when they need to take action
2. **Less anxiety** - No warnings about things the system handles automatically
3. **Clear signals** - Error banner = something is actually broken, go reconnect
4. **Trust in auto-refresh** - System handles token expiry silently

## Testing

### Test Case 1: Normal Operation
```bash
# User has valid refresh token but expired access token
# Expected: No banner, API calls work (auto-refresh happens)
```

### Test Case 2: Revoked Token
```bash
# User revoked access in Google settings
# API call triggers refresh → fails → marks as revoked
# Expected: Error banner appears, "Reconnect Google" button shown
```

### Test Case 3: Fresh Connection
```bash
# User just completed OAuth flow
# Expected: No banner, everything works
```

## Related Changes

- Previous issue: `/docs/BANNER-STATE-TIMING-ISSUE.md`
- Connection health: `src/server/google/status.ts`
- Banner component: `src/components/google-connection-banner.tsx`

## Date

Updated: October 19, 2025
