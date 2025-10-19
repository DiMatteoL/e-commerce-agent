# Google OAuth Token Refresh - Implementation Plan

## Overview
This plan implements a comprehensive solution for handling expired Google OAuth refresh tokens, enabling users to self-recover without database access.

## Goals
1. **Self-Service Recovery**: Users can reconnect their Google account through the UI
2. **Clear Error Communication**: User-friendly error messages with actionable steps
3. **Data Preservation**: Maintain selected GA4 properties and user preferences
4. **Graceful Degradation**: Chat continues working for non-GA4 features
5. **Proactive Detection**: Surface auth issues before they cause errors

## Architecture Components

### 1. Enhanced Error Types
- Structured error responses from backend
- Type-safe error handling across tRPC boundaries
- OAuth-specific error codes

### 2. Account Connection Status API
- New tRPC endpoints to check connection health
- Real-time status updates
- Proactive expiration warnings

### 3. Reconnection Flow
- Preserve existing account row (update, don't create)
- Maintain user's selected GA4 property
- Seamless re-authorization experience

### 4. UI Components
- Account status indicator in header/sidebar
- Reconnection banner/modal
- Enhanced error states in GA4 onboarding dialog
- Chat error handling for OAuth issues

### 5. Testing Strategy
- Unit tests for error handling
- Integration tests for reconnection flow
- Manual testing scenarios

## Implementation Order

1. **Phase 1: Backend Foundation** (Specs 01, 02)
   - Enhanced error types
   - Connection status API
   - Account health checks

2. **Phase 2: Reconnection Flow** (Specs 03, 04)
   - NextAuth configuration updates
   - Account update logic
   - Token refresh improvements

3. **Phase 3: Frontend Integration** (Specs 05, 06)
   - UI components for status and reconnection
   - Error handling in chat
   - GA4 onboarding dialog updates

4. **Phase 4: Testing & Polish** (Spec 07)
   - End-to-end testing
   - Error scenarios
   - UX refinements

## Success Metrics
- Users can reconnect without database access
- Zero manual database interventions needed
- Clear error messages guide user actions
- GA4 property selection persists through reconnection

## Files to Modify
See individual spec files for detailed changes to:
- `src/server/google/client.ts`
- `src/server/api/routers/google_analytics.ts`
- `src/server/auth/config.ts`
- `src/components/ga4-onboarding-dialog.tsx`
- `src/components/app/header.tsx` (or sidebar)
- `src/features/ai-chat/stream/chunk-loop.ts`
- `src/server/db/schema.ts` (minimal changes)

## Dependencies
- Existing: next-auth, tRPC, drizzle-orm, googleapis
- No new dependencies required

## Rollout Plan
1. Deploy backend changes first (backward compatible)
2. Deploy frontend changes
3. Monitor for errors
4. Iterate based on user feedback
