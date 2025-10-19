# Implementation Checklist

Quick reference for implementing the Google OAuth reconnection flow.

## Prerequisites

- [x] Read all specification files (00-07)
- [ ] Review existing codebase structure
- [ ] Set up development environment
- [ ] Create feature branch: `feat/oauth-reconnection`

## Phase 1: Backend Foundation

### Spec 01: Enhanced Error Types
- [ ] Define `GoogleAuthErrorReason` enum in `src/server/google/client.ts`
- [ ] Update `GoogleOAuthRequired` class with enhanced fields
- [ ] Create `getErrorMessages()` helper function
- [ ] Update all `throw GoogleOAuthRequired()` sites with specific reasons
- [ ] Create `src/server/api/errors.ts` with serialization helpers
- [ ] Update `src/server/api/routers/google_analytics.ts` error handling
- [ ] Create `src/types/oauth-errors.ts` for frontend types
- [ ] Test: Error types serialize correctly through tRPC

### Spec 02: Connection Status API
- [ ] Create `src/server/google/status.ts` module
- [ ] Implement `checkGoogleConnectionHealth()` function
- [ ] Implement `markAccountAsRevoked()` function
- [ ] Add tRPC procedures: `getConnectionStatus`, `testConnection`, `disconnectGoogle`
- [ ] Create `src/hooks/use-google-connection-status.ts`
- [ ] Create `src/hooks/use-test-google-connection.ts`
- [ ] (Optional) Add schema fields: `lastRefreshedAt`, `refreshFailureCount`, etc.
- [ ] (Optional) Generate and run migration
- [ ] Test: Connection status returns correct states

## Phase 2: Reconnection Flow

### Spec 03: Account Reconnection Flow
- [ ] Update `src/server/auth/config.ts` with enhanced callbacks
- [ ] Add `allowDangerousEmailAccountLinking: true` to GoogleProvider
- [ ] Implement `signIn` callback to handle account updates
- [ ] Create `src/server/google/reconnect.ts` module
- [ ] Implement `reconcileGoogleAccount()` function
- [ ] Implement `hasValidGoogleConnection()` function
- [ ] Add `verifyReconnection` tRPC procedure
- [ ] Create `src/hooks/use-reconnect-google.ts`
- [ ] Test: Reconnection updates existing account (doesn't create duplicate)
- [ ] Test: Selected property preserved after reconnection

### Spec 04: Token Refresh Improvements
- [ ] Enhance refresh error detection in `getGoogleOAuthClientForUser()`
- [ ] Implement `refreshAccessTokenWithRetry()` function
- [ ] Add detailed error classification (invalid_grant, server errors, etc.)
- [ ] Create `src/server/google/proactive-refresh.ts` module
- [ ] Implement `refreshExpiringTokens()` function
- [ ] Add `checkTokenRefreshStatus()` to status module
- [ ] (Optional) Create admin monitoring endpoint
- [ ] (Optional) Set up cron job for proactive refresh
- [ ] Update refresh logic to clear invalid refresh tokens
- [ ] Test: Retry logic works for transient failures
- [ ] Test: Invalid tokens are cleared appropriately

## Phase 3: Frontend Integration

### Spec 05: UI Components
- [ ] Create `src/components/google-connection-banner.tsx`
- [ ] Create `src/components/chat-oauth-error.tsx`
- [ ] Create `src/components/google-connection-indicator.tsx`
- [ ] Create `src/components/google-connection-settings.tsx`
- [ ] Update `src/components/ga4-onboarding-dialog.tsx` with OAuth error handling
- [ ] Add translation keys to `messages/en.json` (and `fr.json`)
- [ ] Integrate banner into main layout
- [ ] Integrate indicator into sidebar/header
- [ ] (Optional) Create settings page with connection panel
- [ ] Test: Components render correctly
- [ ] Test: Reconnection flow works from UI

### Spec 06: Chat Error Handling
- [ ] Update `src/features/ai-chat/stream/chunk-loop.ts` with OAuth detection
- [ ] Add `isOAuthError()` type guard
- [ ] Enhance error payload for OAuth errors
- [ ] Update `src/features/ai-chat/prompts/system.ts` with OAuth instructions
- [ ] Update `src/components/chat-message.tsx` to detect OAuth errors
- [ ] Create `src/components/chat-error-boundary.tsx`
- [ ] Wrap chat component with error boundary
- [ ] Add connection monitoring to chat component
- [ ] Enhance `src/types/oauth-errors.ts` with chat types
- [ ] Test: OAuth errors display correctly in chat
- [ ] Test: AI responds appropriately to OAuth errors
- [ ] Test: Non-GA4 queries work with expired token

## Phase 4: Testing & Quality

### Spec 07: Testing and Rollout
- [ ] Write unit tests for error classification
- [ ] Write unit tests for connection status
- [ ] Write unit tests for token refresh
- [ ] Write integration tests for reconnection flow
- [ ] Write integration tests for chat error handling
- [ ] Perform manual testing of all scenarios:
  - [ ] New user onboarding
  - [ ] Token expiration
  - [ ] Revoked access
  - [ ] Missing scopes
  - [ ] Multiple tabs
- [ ] Load test connection status API
- [ ] Security testing (unauthorized access, etc.)
- [ ] Performance testing
- [ ] Set up monitoring and alerts
- [ ] Create user documentation
- [ ] Create developer documentation

## Deployment

### Pre-Deployment
- [ ] All tests passing
- [ ] Code review completed
- [ ] QA sign-off
- [ ] Monitoring set up
- [ ] Rollback plan documented
- [ ] Feature flags configured

### Deployment Steps
- [ ] Stage 1: Deploy to development
- [ ] Stage 2: Deploy to staging, full testing
- [ ] Stage 3: Canary release (5% production)
- [ ] Stage 4: Gradual rollout (25%, 50%, 75%, 100%)
- [ ] Stage 5: Monitor and optimize

### Post-Deployment
- [ ] Monitor reconnection success rate
- [ ] Monitor error rates
- [ ] Collect user feedback
- [ ] Week 1 review
- [ ] Month 1 review
- [ ] Address any issues found

## Quick Command Reference

```bash
# Create new branch
git checkout -b feat/oauth-reconnection

# Install dependencies (if any new ones)
bun install

# Generate database migration (if schema changes)
bun run db:generate
bun run db:migrate

# Run tests
bun test

# Type check
bun run typecheck

# Lint
bun run lint

# Build
bun run build

# Deploy staging
./deploy-staging.sh

# Deploy production
./deploy-production.sh
```

## File Creation Order

Create files in this order to minimize dependency issues:

1. `src/server/google/client.ts` (enhance existing)
2. `src/server/api/errors.ts` (new)
3. `src/types/oauth-errors.ts` (new)
4. `src/server/google/status.ts` (new)
5. `src/server/google/reconnect.ts` (new)
6. `src/server/google/proactive-refresh.ts` (new)
7. `src/server/auth/config.ts` (enhance existing)
8. `src/server/api/routers/google_analytics.ts` (enhance existing)
9. `src/hooks/use-google-connection-status.ts` (new)
10. `src/hooks/use-reconnect-google.ts` (new)
11. `src/components/google-connection-banner.tsx` (new)
12. `src/components/chat-oauth-error.tsx` (new)
13. `src/components/google-connection-indicator.tsx` (new)
14. `src/components/google-connection-settings.tsx` (new)
15. `src/components/ga4-onboarding-dialog.tsx` (enhance existing)
16. `src/features/ai-chat/stream/chunk-loop.ts` (enhance existing)
17. `src/features/ai-chat/prompts/system.ts` (enhance existing)
18. `src/components/chat-message.tsx` (enhance existing)
19. `src/components/chat-error-boundary.tsx` (new)
20. `src/components/chat.tsx` (enhance existing)

## Common Pitfalls to Avoid

1. **Don't create duplicate accounts**
   - Always use same `providerAccountId` as key
   - Test reconnection preserves data

2. **Don't expose tokens to frontend**
   - Never return `refresh_token` or `access_token` in API responses
   - Use serialization helpers

3. **Don't skip error classification**
   - Distinguish between revoked, expired, and missing
   - Provide specific user messages

4. **Don't forget existing users**
   - Handle accounts created before scope was added
   - Gracefully upgrade their permissions

5. **Don't ignore race conditions**
   - Handle multiple tab scenarios
   - Test concurrent reconnection attempts

6. **Don't skip translations**
   - Add keys for all user-facing messages
   - Support all application languages

7. **Don't deploy without feature flags**
   - Use flags for gradual rollout
   - Enable quick rollback if needed

## Success Validation

Before marking complete, verify:

- [ ] User can reconnect without database access ✅
- [ ] Selected GA4 property preserved ✅
- [ ] Clear error messages throughout UI ✅
- [ ] Chat handles OAuth errors gracefully ✅
- [ ] Non-GA4 features work with expired token ✅
- [ ] Reconnection success rate > 95% ✅
- [ ] No duplicate accounts created ✅
- [ ] All tests passing ✅
- [ ] Documentation complete ✅
- [ ] Monitoring in place ✅

## Support Resources

- **Architecture Diagram**: See `00-OVERVIEW.md`
- **API Reference**: See individual spec files
- **Testing Guide**: See `07-TESTING-AND-ROLLOUT.md`
- **Troubleshooting**: Check monitoring dashboard
- **Questions**: Review spec files or ask team

## Time Estimates

- **Phase 1 (Backend Foundation)**: 2-3 days
- **Phase 2 (Reconnection Flow)**: 2-3 days
- **Phase 3 (Frontend Integration)**: 3-4 days
- **Phase 4 (Testing & QA)**: 2-3 days
- **Total**: 9-13 days for complete implementation

## Notes

- All changes are backward compatible
- No breaking changes to existing API
- Schema changes are optional but recommended
- Can be implemented incrementally
- Feature flags allow safe rollout

---

**Last Updated**: [Current Date]
**Status**: Ready for Implementation
**Assigned To**: [Developer Name]
