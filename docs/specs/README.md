# Google OAuth Token Refresh - Specification Documentation

## Problem Statement

Users experience errors when their Google OAuth refresh tokens expire or are revoked. Currently, the only way to recover is manual database intervention to delete the account row. This creates a poor user experience and requires administrative support.

## Solution Overview

Implement a comprehensive self-service reconnection flow that:
1. **Detects** token expiration/revocation proactively
2. **Communicates** clear, actionable error messages to users
3. **Enables** one-click reconnection through the UI
4. **Preserves** user data (selected GA4 property, preferences)
5. **Handles** errors gracefully throughout the application

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
├─────────────────────────────────────────────────────────────┤
│  • Connection Status Banner                                  │
│  • Reconnection Button/Flow                                  │
│  • Chat Error Handling                                       │
│  • Status Indicator (Header/Sidebar)                         │
└────────────────┬────────────────────────────────────────────┘
                 │ tRPC API
┌────────────────▼────────────────────────────────────────────┐
│                         Backend                              │
├─────────────────────────────────────────────────────────────┤
│  • Enhanced Error Types (GoogleAuthErrorReason)              │
│  • Connection Health API (status, test, disconnect)          │
│  • Token Refresh with Retry Logic                           │
│  • Proactive Token Refresh (optional cron)                  │
│  • Account Reconciliation (prevent duplicates)              │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│                    NextAuth Integration                      │
├─────────────────────────────────────────────────────────────┤
│  • Enhanced signIn Callback                                  │
│  • Update Existing Account (not create new)                 │
│  • Preserve User Associations                                │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│                        Database                              │
├─────────────────────────────────────────────────────────────┤
│  • accounts (existing + optional tracking fields)            │
│  • googleAnalyticsProperties (preserved)                     │
└─────────────────────────────────────────────────────────────┘
```

## Specification Files

### [00-OVERVIEW.md](./00-OVERVIEW.md)
**Purpose**: High-level architecture and implementation phases
**Key Sections**:
- Goals and success metrics
- Architecture components
- Implementation order
- Files to modify
- Rollout plan

**Start Here**: Read first for context

---

### [01-ERROR-TYPES.md](./01-ERROR-TYPES.md)
**Purpose**: Enhanced error handling and type safety
**Key Components**:
- `GoogleAuthErrorReason` enum
- Enhanced `GoogleOAuthRequired` error class
- tRPC error serialization helpers
- Frontend type definitions

**Technical Depth**: ⭐⭐⭐
**Implementation Time**: ~1 day

---

### [02-CONNECTION-STATUS-API.md](./02-CONNECTION-STATUS-API.md)
**Purpose**: Proactive connection health monitoring
**Key Components**:
- `checkGoogleConnectionHealth()` function
- tRPC endpoints: `getConnectionStatus`, `testConnection`, `disconnectGoogle`
- React hooks for status consumption
- Optional schema enhancements

**Technical Depth**: ⭐⭐⭐
**Implementation Time**: ~1-2 days

---

### [03-RECONNECTION-FLOW.md](./03-RECONNECTION-FLOW.md)
**Purpose**: Seamless account reconnection without data loss
**Key Components**:
- Enhanced NextAuth configuration
- Account reconciliation logic
- Property preservation
- Post-reconnection verification

**Technical Depth**: ⭐⭐⭐⭐
**Implementation Time**: ~2 days
**Critical**: Prevents duplicate accounts

---

### [04-TOKEN-REFRESH-IMPROVEMENTS.md](./04-TOKEN-REFRESH-IMPROVEMENTS.md)
**Purpose**: Robust token refresh with retry and proactive refresh
**Key Components**:
- Enhanced error detection (invalid_grant, server errors, etc.)
- Retry logic with exponential backoff
- Proactive token refresh (background job)
- Token health tracking

**Technical Depth**: ⭐⭐⭐⭐
**Implementation Time**: ~2 days
**Optional**: Proactive refresh can be added later

---

### [05-UI-COMPONENTS.md](./05-UI-COMPONENTS.md)
**Purpose**: User-facing components for status and reconnection
**Key Components**:
- `GoogleConnectionBanner` - Top banner for warnings
- `GoogleConnectionIndicator` - Status icon in sidebar
- `ChatOAuthError` - Error display in chat
- `GoogleConnectionSettings` - Settings panel
- Enhanced `GA4OnboardingDialog`

**Technical Depth**: ⭐⭐
**Implementation Time**: ~3 days
**User Impact**: Highest visibility

---

### [06-CHAT-ERROR-HANDLING.md](./06-CHAT-ERROR-HANDLING.md)
**Purpose**: Graceful OAuth error handling in AI chat
**Key Components**:
- Enhanced tool error detection in `chunk-loop.ts`
- System prompt updates for AI
- Chat error boundary
- Real-time connection monitoring

**Technical Depth**: ⭐⭐⭐
**Implementation Time**: ~2 days
**User Impact**: Critical for chat experience

---

### [07-TESTING-AND-ROLLOUT.md](./07-TESTING-AND-ROLLOUT.md)
**Purpose**: Comprehensive testing strategy and deployment plan
**Key Sections**:
- Unit test examples
- Integration test scenarios
- Manual testing checklist
- Rollout phases
- Monitoring and metrics
- Rollback plan

**Technical Depth**: ⭐⭐
**Time**: ~2-3 days
**Critical**: Ensures quality and safe deployment

---

### [08-IMPLEMENTATION-CHECKLIST.md](./08-IMPLEMENTATION-CHECKLIST.md)
**Purpose**: Step-by-step implementation guide
**Use Case**: Daily reference during implementation
**Includes**:
- Complete checklist of all tasks
- File creation order
- Common pitfalls to avoid
- Success validation criteria
- Time estimates

**Practical**: ⭐⭐⭐⭐⭐
**Keep Open**: While implementing

---

## Quick Start Guide

### For Project Managers
1. Read `00-OVERVIEW.md` for goals and timeline
2. Review `07-TESTING-AND-ROLLOUT.md` for deployment plan
3. Check `08-IMPLEMENTATION-CHECKLIST.md` for progress tracking

### For Developers
1. Read `00-OVERVIEW.md` for context
2. Review `08-IMPLEMENTATION-CHECKLIST.md` for task breakdown
3. Implement in order: Specs 01 → 02 → 03 → 04 → 05 → 06
4. Follow `07-TESTING-AND-ROLLOUT.md` for testing

### For QA Engineers
1. Focus on `07-TESTING-AND-ROLLOUT.md`
2. Use manual testing scenarios as test cases
3. Validate against success criteria in `08-IMPLEMENTATION-CHECKLIST.md`

### For DevOps
1. Review `07-TESTING-AND-ROLLOUT.md` - Rollout Plan section
2. Set up monitoring from metrics section
3. Configure feature flags
4. Prepare rollback procedures

## Implementation Phases

### Phase 1: Backend Foundation (Specs 01-02)
**Duration**: 2-3 days
**Goal**: Error handling and status API
**Deliverable**: Backend can detect and classify OAuth issues

### Phase 2: Reconnection Flow (Specs 03-04)
**Duration**: 2-3 days
**Goal**: Working reconnection without data loss
**Deliverable**: Users can reconnect via API

### Phase 3: Frontend Integration (Specs 05-06)
**Duration**: 3-4 days
**Goal**: User-facing UI and chat integration
**Deliverable**: Complete user experience

### Phase 4: Testing & Deployment (Spec 07)
**Duration**: 2-3 days
**Goal**: Quality assurance and safe rollout
**Deliverable**: Production-ready feature

**Total Time**: 9-13 days

## Key Technologies

- **Framework**: Next.js 14+ (App Router)
- **API Layer**: tRPC v11
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: NextAuth.js v5 (beta)
- **OAuth**: Google OAuth 2.0
- **UI**: React 18, Tailwind CSS, shadcn/ui
- **Testing**: Vitest, Playwright
- **Monitoring**: Custom (spec includes examples)

## Success Criteria

- ✅ Users can reconnect without database access
- ✅ Zero duplicate accounts created
- ✅ Selected GA4 property preserved
- ✅ Reconnection success rate > 95%
- ✅ Clear error messages throughout UI
- ✅ Chat handles OAuth errors gracefully
- ✅ Non-GA4 features work with expired token
- ✅ < 3 clicks to complete reconnection
- ✅ All tests passing

## Dependencies

### Required
- `next-auth` >= 5.0.0-beta (for enhanced callbacks)
- `@trpc/server` >= 11.0.0
- `drizzle-orm` (current version)
- `googleapis` (current version)

### No New Dependencies
All changes use existing libraries in the project.

## Breaking Changes

**None** - All changes are backward compatible:
- Existing error handling continues to work
- New error types are additive
- Schema changes are optional
- UI components are new additions

## Risk Assessment

### Low Risk
- Error type enhancements (additive)
- UI components (new, isolated)
- Status API (read-only, no mutations)

### Medium Risk
- Token refresh retry logic (changes existing behavior)
- Chat error handling (modifies streaming logic)

### Higher Risk (Mitigated)
- NextAuth callback modifications (thoroughly tested)
- Account reconciliation (handles edge cases)

**Mitigation**: Feature flags, gradual rollout, comprehensive testing

## Support & Maintenance

### Monitoring Dashboards
- Reconnection success rate
- Token refresh failures
- Connection health distribution
- User error rates

### Documentation
- User help articles (how to reconnect)
- Developer API docs (error handling)
- Runbook for common issues

### On-Call Procedures
- High failure rate alert → Check logs
- OAuth callback issues → Verify credentials
- Database issues → Check indexes

## Additional Resources

- **Google OAuth 2.0 Docs**: https://developers.google.com/identity/protocols/oauth2
- **NextAuth.js Docs**: https://authjs.dev/
- **tRPC Error Handling**: https://trpc.io/docs/error-handling
- **Drizzle ORM**: https://orm.drizzle.team/

## Questions?

For questions during implementation:
1. Check the relevant spec file
2. Review `08-IMPLEMENTATION-CHECKLIST.md` common pitfalls
3. Consult architecture diagram in `00-OVERVIEW.md`
4. Reference testing scenarios in `07-TESTING-AND-ROLLOUT.md`

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-10-19 | 1.0 | Initial specification | AI Assistant |

## Next Steps

1. ✅ Review all specification files
2. ✅ Get team sign-off on approach
3. ⏭️ Create feature branch
4. ⏭️ Begin Phase 1 implementation
5. ⏭️ Set up monitoring infrastructure
6. ⏭️ Plan deployment timeline

---

**Status**: ✅ Ready for Implementation
**Priority**: High (User Impact)
**Complexity**: Medium (Well-specified)
**Timeline**: 2-3 weeks (including testing & rollout)
