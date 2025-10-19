# Spec 07: Testing Strategy and Rollout Plan

## Objective
Comprehensive testing plan to ensure OAuth reconnection flow works reliably, doesn't break existing functionality, and provides excellent user experience.

## Testing Phases

### Phase 1: Unit Tests

#### Backend Tests

**File**: `src/server/google/__tests__/client.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getGoogleOAuthClientForUser, GoogleOAuthRequired, GoogleAuthErrorReason } from "../client";
import { db } from "@/server/db";

describe("Google OAuth Client", () => {
  describe("Error Classification", () => {
    it("should throw NO_ACCOUNT when user has no Google account", async () => {
      // Mock DB to return no account
      vi.spyOn(db, "select").mockResolvedValueOnce([]);

      await expect(getGoogleOAuthClientForUser("test-user")).rejects.toThrow(
        GoogleOAuthRequired,
      );

      try {
        await getGoogleOAuthClientForUser("test-user");
      } catch (err) {
        expect(err).toBeInstanceOf(GoogleOAuthRequired);
        expect((err as GoogleOAuthRequired).reason).toBe(GoogleAuthErrorReason.NO_ACCOUNT);
      }
    });

    it("should throw MISSING_SCOPES when Analytics scope is missing", async () => {
      const accountWithoutScopes = {
        userId: "test-user",
        provider: "google",
        access_token: "token",
        refresh_token: "refresh",
        scope: "openid email profile", // Missing analytics scope
      };

      vi.spyOn(db, "select").mockResolvedValueOnce([accountWithoutScopes]);

      await expect(getGoogleOAuthClientForUser("test-user")).rejects.toThrow(
        GoogleOAuthRequired,
      );
    });

    it("should throw TOKEN_EXPIRED when token expired and no refresh token", async () => {
      const expiredAccount = {
        userId: "test-user",
        provider: "google",
        access_token: "token",
        refresh_token: null,
        expires_at: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        scope: "openid email profile https://www.googleapis.com/auth/analytics.readonly",
      };

      vi.spyOn(db, "select").mockResolvedValueOnce([expiredAccount]);

      await expect(getGoogleOAuthClientForUser("test-user")).rejects.toThrow(
        GoogleOAuthRequired,
      );
    });
  });

  describe("Token Refresh", () => {
    it("should successfully refresh expired token", async () => {
      // Test implementation
    });

    it("should retry on server errors", async () => {
      // Test retry logic
    });

    it("should not retry on invalid_grant", async () => {
      // Test that permanent errors don't retry
    });
  });
});
```

**File**: `src/server/google/__tests__/status.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { checkGoogleConnectionHealth } from "../status";

describe("Connection Status", () => {
  it("should return not_connected for user without account", async () => {
    const health = await checkGoogleConnectionHealth("no-account-user");
    expect(health.status).toBe("not_connected");
    expect(health.needsReconnection).toBe(true);
  });

  it("should return connected for healthy account", async () => {
    // Mock healthy account
    const health = await checkGoogleConnectionHealth("healthy-user");
    expect(health.status).toBe("connected");
    expect(health.isHealthy).toBe(true);
  });

  it("should return expiring_soon for soon-to-expire tokens", async () => {
    // Mock account expiring in 3 days
    const health = await checkGoogleConnectionHealth("expiring-user");
    expect(health.status).toBe("expiring_soon");
  });
});
```

#### Frontend Tests

**File**: `src/hooks/__tests__/use-google-connection-status.test.tsx`

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { useGoogleConnectionStatus } from "../use-google-connection-status";

describe("useGoogleConnectionStatus", () => {
  it("should fetch and return connection status", async () => {
    const { result } = renderHook(() => useGoogleConnectionStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toHaveProperty("status");
    expect(result.current).toHaveProperty("isHealthy");
  });
});
```

### Phase 2: Integration Tests

#### Reconnection Flow Test

**File**: `tests/integration/oauth-reconnection.test.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("OAuth Reconnection Flow", () => {
  test("should reconnect expired account", async ({ page, context }) => {
    // 1. Login with expired token
    await page.goto("/");
    await mockExpiredToken(page);

    // 2. Navigate to chat
    await page.goto("/chat");

    // 3. Verify banner appears
    await expect(page.locator('[data-testid="oauth-banner"]')).toBeVisible();

    // 4. Click reconnect
    await page.click('[data-testid="reconnect-button"]');

    // 5. Handle OAuth flow (mock or real)
    await handleOAuthFlow(page, context);

    // 6. Verify banner disappears
    await expect(page.locator('[data-testid="oauth-banner"]')).not.toBeVisible();

    // 7. Verify connection indicator shows green
    await expect(page.locator('[data-testid="connection-status"]')).toHaveClass(/connected/);
  });

  test("should preserve selected GA4 property after reconnection", async ({ page }) => {
    // 1. Set up user with selected property
    const selectedProperty = "properties/123456";
    await setupUserWithProperty(page, selectedProperty);

    // 2. Trigger reconnection
    await reconnectAccount(page);

    // 3. Verify property still selected
    const property = await getSelectedProperty(page);
    expect(property).toBe(selectedProperty);
  });
});
```

#### Chat Error Handling Test

**File**: `tests/integration/chat-oauth-errors.test.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("Chat OAuth Error Handling", () => {
  test("should show clear error when GA4 query fails due to OAuth", async ({ page }) => {
    await page.goto("/chat");

    // Mock expired token
    await mockExpiredToken(page);

    // Send GA4 query
    await page.fill('[data-testid="chat-input"]', "Show me top products");
    await page.press('[data-testid="chat-input"]', "Enter");

    // Wait for response
    await page.waitForSelector('[data-testid="chat-message"]');

    // Verify error message is user-friendly
    const lastMessage = page.locator('[data-testid="chat-message"]').last();
    await expect(lastMessage).toContainText("Google Analytics connection");
    await expect(lastMessage).toContainText("reconnect");

    // Verify reconnection prompt appears
    await expect(page.locator('[data-testid="oauth-error"]')).toBeVisible();
  });

  test("should allow non-GA4 queries to work with expired token", async ({ page }) => {
    await page.goto("/chat");
    await mockExpiredToken(page);

    // Send non-GA4 query
    await page.fill('[data-testid="chat-input"]', "Hello, how are you?");
    await page.press('[data-testid="chat-input"]', "Enter");

    // Wait for response
    await page.waitForSelector('[data-testid="chat-message"]');

    // Verify response is normal (not an error)
    const lastMessage = page.locator('[data-testid="chat-message"]').last();
    await expect(lastMessage).not.toContainText("expired");
    await expect(lastMessage).not.toContainText("reconnect");
  });
});
```

### Phase 3: Manual Testing Scenarios

#### Scenario 1: New User Onboarding
```
Steps:
1. Create new account
2. Navigate to GA4 onboarding
3. Click "Connect Google"
4. Complete OAuth flow
5. Select GA4 property
6. Verify chat works with GA4 queries

Expected:
✅ Smooth onboarding
✅ All scopes granted
✅ Property selected and persisted
✅ GA4 tools work in chat
```

#### Scenario 2: Token Expiration
```
Steps:
1. Login with valid account
2. Manually expire token in database:
   UPDATE accounts SET expires_at = extract(epoch from now() - interval '1 hour')
   WHERE user_id = 'test-user';
3. Refresh page
4. Verify banner appears
5. Click reconnect
6. Complete OAuth
7. Verify banner disappears

Expected:
✅ Banner shows with clear message
✅ Reconnection works
✅ Selected property preserved
✅ Can use GA4 features immediately
```

#### Scenario 3: Revoked Access
```
Steps:
1. Login with valid account
2. Go to https://myaccount.google.com/connections
3. Revoke access to your app
4. Return to app
5. Try GA4 query in chat
6. Observe error handling
7. Click reconnect
8. Re-grant access
9. Verify works again

Expected:
✅ Clear error message
✅ Reconnection prompt in chat
✅ Banner at top
✅ Successful reconnection
✅ GA4 features work after reconnect
```

#### Scenario 4: Missing Scopes (Upgrade)
```
Steps:
1. Simulate old user with only basic scopes:
   UPDATE accounts SET scope = 'openid email profile'
   WHERE user_id = 'test-user';
2. Try to use GA4 feature
3. Verify error about missing permissions
4. Click reconnect
5. Verify new OAuth prompt shows Analytics scope
6. Grant permissions
7. Verify works

Expected:
✅ Clear "additional permissions" message
✅ Reconnection requests all scopes
✅ Works after granting
```

#### Scenario 5: Multiple Tabs
```
Steps:
1. Open app in two browser tabs
2. In tab 1, trigger reconnection
3. Complete OAuth flow
4. Switch to tab 2
5. Verify status updates
6. Try GA4 query in tab 2

Expected:
✅ Tab 2 detects reconnection
✅ Status indicator updates
✅ GA4 features work without refresh
```

### Phase 4: Load Testing

#### Connection Status API Performance
```bash
# Test connection status endpoint
ab -n 1000 -c 10 -H "Cookie: auth-token" \
  https://app.com/api/trpc/google_analytics.getConnectionStatus

Expected:
- 95th percentile < 100ms
- 99th percentile < 200ms
- Zero errors
```

#### Token Refresh Performance
```typescript
// Simulate 100 users with expired tokens
async function testProactiveRefresh() {
  const results = await refreshExpiringTokens();

  console.log(`Refreshed: ${results.refreshed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);

  expect(results.failed).toBeLessThan(results.refreshed * 0.05); // < 5% failure rate
}
```

### Phase 5: Security Testing

#### Test Cases
1. **Cannot access other users' connection status**
   - Try to query status for different userId
   - Should return unauthorized

2. **Cannot hijack account through reconnection**
   - Try to reconnect with different Google account
   - Should maintain proper user associations

3. **Tokens not exposed to frontend**
   - Inspect all API responses
   - Verify no refresh_token or access_token in responses

4. **Rate limiting on reconnection endpoints**
   - Attempt rapid reconnections
   - Should have reasonable rate limits

## Rollout Plan

### Stage 1: Development (Week 1)
- ✅ Implement all backend changes
- ✅ Implement all frontend components
- ✅ Unit tests pass
- ✅ Local testing complete

### Stage 2: Staging Deployment (Week 2)
- Deploy to staging environment
- Run integration tests
- Manual testing of all scenarios
- Performance testing
- Fix any issues found

### Stage 3: Canary Release (Week 3)
- Deploy to 5% of production users
- Monitor metrics:
  - Reconnection success rate
  - Error rates
  - User feedback
- Collect logs and debug any issues
- Verify no regressions

### Stage 4: Gradual Rollout (Week 4)
- 25% of users
- 50% of users
- 75% of users
- 100% of users
- Monitor at each stage
- Be prepared to rollback

### Stage 5: Monitoring & Optimization (Ongoing)
- Monitor success metrics
- Gather user feedback
- Optimize flows based on data
- Document learnings

## Monitoring & Metrics

### Key Metrics to Track

```typescript
// Example monitoring dashboard queries

// 1. Reconnection success rate
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_reconnections,
  SUM(CASE WHEN successful THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN successful THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
FROM oauth_reconnection_events
GROUP BY DATE(created_at)
ORDER BY date DESC;

// 2. Token refresh success rate
SELECT
  DATE(last_refreshed_at) as date,
  COUNT(*) as total_refreshes,
  AVG(refresh_failure_count) as avg_failures
FROM accounts
WHERE provider = 'google'
  AND last_refreshed_at IS NOT NULL
GROUP BY DATE(last_refreshed_at);

// 3. Connection health distribution
SELECT
  status,
  COUNT(*) as count,
  COUNT(*)::float / SUM(COUNT(*)) OVER () as percentage
FROM (
  SELECT
    CASE
      WHEN refresh_token IS NULL THEN 'no_refresh_token'
      WHEN expires_at < extract(epoch from now()) THEN 'expired'
      WHEN expires_at < extract(epoch from now() + interval '7 days') THEN 'expiring_soon'
      ELSE 'healthy'
    END as status
  FROM accounts
  WHERE provider = 'google'
) t
GROUP BY status;
```

### Alerts to Set Up

1. **High Failure Rate**
   - Alert if reconnection failure rate > 10%
   - Alert if token refresh failure rate > 5%

2. **System Issues**
   - Alert if no successful OAuth callbacks in 1 hour
   - Alert if connection status API latency > 500ms

3. **User Impact**
   - Alert if > 100 users need reconnection simultaneously
   - Alert if GA4 tool error rate spikes

### Logging Best Practices

```typescript
// Log structure for debugging
console.log({
  event: "oauth_reconnection_started",
  userId: user.id,
  previousExpiry: account.expires_at,
  reason: "token_expired",
  timestamp: new Date().toISOString(),
});

console.log({
  event: "oauth_reconnection_completed",
  userId: user.id,
  success: true,
  newExpiry: newAccount.expires_at,
  duration_ms: Date.now() - startTime,
  timestamp: new Date().toISOString(),
});
```

## Rollback Plan

### Trigger Conditions
- Reconnection success rate < 80%
- Critical bug affecting users
- Database performance degradation
- Unexpected behavior

### Rollback Steps
1. **Immediate**: Disable reconnection UI (feature flag)
2. **Quick**: Revert frontend deployment
3. **Full**: Revert backend deployment
4. **Database**: Schema changes are additive (safe to leave)

### Feature Flags

```typescript
// src/lib/feature-flags.ts
export const FEATURES = {
  OAUTH_RECONNECTION: process.env.FEATURE_OAUTH_RECONNECTION === "true",
  PROACTIVE_REFRESH: process.env.FEATURE_PROACTIVE_REFRESH === "true",
  CONNECTION_STATUS_BANNER: process.env.FEATURE_CONNECTION_BANNER === "true",
} as const;

// Usage in components
if (FEATURES.OAUTH_RECONNECTION) {
  return <GoogleConnectionBanner />;
}
```

## Success Criteria

### Must Have (Before Full Rollout)
- ✅ 95%+ reconnection success rate
- ✅ Zero data loss (properties preserved)
- ✅ < 3 clicks to reconnect
- ✅ Clear error messages
- ✅ All tests passing

### Nice to Have (Optimize Later)
- ⭐ < 5 seconds reconnection time
- ⭐ 99%+ token refresh success
- ⭐ Zero user-reported confusion
- ⭐ Proactive refresh prevents 95% of errors

## Documentation

### User-Facing Documentation
- Help article: "How to reconnect your Google Analytics"
- FAQ: "Why do I need to reconnect?"
- Troubleshooting guide

### Developer Documentation
- Architecture diagram
- Error handling guide
- Monitoring playbook
- Debugging tips

## Post-Launch Review

### Week 1 Review
- Analyze metrics
- Review user feedback
- Identify issues
- Plan improvements

### Month 1 Review
- Overall success assessment
- ROI analysis (reduced support tickets)
- UX improvements identified
- Technical debt assessment

## Conclusion

This comprehensive testing and rollout plan ensures:
1. High-quality implementation
2. Minimal risk deployment
3. Clear success metrics
4. Quick rollback capability
5. Continuous monitoring and improvement

The phased approach allows catching issues early while minimizing user impact.
