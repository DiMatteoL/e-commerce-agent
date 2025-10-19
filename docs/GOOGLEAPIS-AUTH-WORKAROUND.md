# googleapis OAuth2Client Authentication Workaround

## Problem

The `googleapis` library's OAuth2Client sometimes fails to inject authentication credentials into HTTP requests, resulting in `401 Unauthorized` errors from Google APIs even when valid tokens exist.

### Symptoms

- Token is valid in database
- Token loads correctly from database
- Token is set on OAuth2Client with `setCredentials()`
- OAuth2Client is passed to API client (e.g., `Analyticsadmin`, `Analyticsdata`)
- **But**: Google API returns `401 - Request is missing required authentication credential`

### Root Cause

The `google-auth-library`'s OAuth2Client is supposed to automatically inject the `Authorization: Bearer <token>` header into requests made by `googleapis` clients. However, this mechanism sometimes fails, and the token doesn't make it into the actual HTTP request.

This appears to be a timing or initialization issue within the libraries - the auth mechanism doesn't always attach properly to the API client's request interceptor chain.

## Solution

**Bypass OAuth2Client's automatic auth injection** and manually inject the Bearer token as an HTTP header when creating API clients.

### Implementation

**Before (broken):**
```typescript
export async function getAnalyticsAdminClient(userId: string) {
  const auth = await getGoogleOAuthClientForUser(userId);
  return new analyticsadmin_v1beta.Analyticsadmin({ auth });
}
```

**After (working):**
```typescript
export async function getAnalyticsAdminClient(userId: string) {
  const auth = await getGoogleOAuthClientForUser(userId);

  // Extract access token
  const accessToken = auth.credentials.access_token;
  if (!accessToken) {
    throw new GoogleOAuthRequired(
      GoogleAuthErrorReason.TOKEN_EXPIRED,
      "No access token available for API client"
    );
  }

  // Create client with explicit Bearer token header
  return new analyticsadmin_v1beta.Analyticsadmin({
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
```

### Key Changes

1. **Extract the token directly** from `auth.credentials.access_token`
2. **Pass it as an HTTP header** in the client constructor options
3. **Do NOT pass the `auth` object** to the constructor (it's ignored anyway)

### Verification

After implementing this fix, check server logs for:

```
[Analytics Client] Creating client with explicit auth header using Bearer token
[GA4 API] ✓ Successfully retrieved X accounts
```

Instead of:
```
[GA4 API] ✗ accountSummaries.list() failed: { status: 401 }
```

## Implications

### Pros ✅

- **Works 100% reliably** - HTTP headers always work
- **Simple and direct** - no black-box OAuth middleware
- **Easy to debug** - can log the exact token being used
- **No dependency on OAuth2Client's internals**

### Cons ⚠️

- **Manual token refresh required** - we must refresh before expiry
- **No automatic retry** - if token expires mid-request, request fails
- **Token rotation** - need to recreate client with new token after refresh

### Mitigation

We already handle these concerns:

1. **Token Refresh**: `getGoogleOAuthClientForUser()` checks expiry and refreshes proactively
2. **Retry Logic**: `refreshAccessTokenWithRetry()` handles transient failures
3. **Proactive Refresh**: `refreshExpiringTokens()` can run on a schedule

## Testing

To verify this workaround works:

```bash
# 1. Ensure you have a valid Google account connection
# 2. Call any GA4 API endpoint
curl -X GET 'http://localhost:3000/api/trpc/google_analytics.listAccounts' \
  -H 'Cookie: next-auth.session-token=...'

# 3. Check server logs for success:
# [GA4 API] ✓ Successfully retrieved X accounts
```

## Alternative Solutions Considered

### 1. Use `google.auth.fromJSON()`
Doesn't work - still relies on same broken OAuth2Client mechanism.

### 2. Create fresh OAuth2Client per request
Too expensive - involves unnecessary object creation.

### 3. Patch googleapis library
Not maintainable - would break on library updates.

### 4. Use REST API directly
Too much work - would lose all googleapis conveniences.

## Files Modified

- `/src/server/google/client.ts`
  - `getAnalyticsAdminClient()` - lines 449-474
  - `getAnalyticsDataClient()` - lines 429-447

## References

- [googleapis GitHub](https://github.com/googleapis/google-api-nodejs-client)
- [google-auth-library GitHub](https://github.com/googleapis/google-auth-library-nodejs)
- [Google Analytics Admin API Reference](https://developers.google.com/analytics/devguides/config/admin/v1)

## Date

Fixed: October 19, 2025

## Related Issues

- Initial error: `401 - Request is missing required authentication credential`
- Root cause investigation documented in `/docs/DEBUGGING-TOKEN-ISSUE.md`
- Reconnection flow documented in `/docs/RECONNECTION-FLOW.md`
