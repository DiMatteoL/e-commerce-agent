# Architecture Diagram - OAuth Reconnection Flow

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │
│  │ Connection Banner   │  │ Status Indicator │  │  GA4 Onboarding     │   │
│  │ (Top of Page)       │  │ (Sidebar/Header) │  │  Dialog             │   │
│  │                     │  │                  │  │                      │   │
│  │ [!] Expired         │  │  🟢 Connected    │  │  ┌────────────────┐ │   │
│  │ [Reconnect Button]  │  │  🔴 Expired      │  │  │ Select Property│ │   │
│  └─────────────────────┘  │  🟡 Expiring     │  │  └────────────────┘ │   │
│                            └──────────────────┘  │  [Reconnect Error] │   │
│                                                   └──────────────────────┘   │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          CHAT INTERFACE                                │ │
│  │                                                                        │ │
│  │  User: "Show me top products by revenue"                             │ │
│  │                                                                        │ │
│  │  Assistant: "I encountered an issue accessing your Google            │ │
│  │  Analytics data. Your connection has expired..."                     │ │
│  │                                                                        │ │
│  │  ┌────────────────────────────────────────────────────────────────┐ │ │
│  │  │ [!] Google Analytics Connection Required                       │ │ │
│  │  │ Your connection has expired. Click to reconnect.               │ │ │
│  │  │ [Reconnect Google Account]                                     │ │ │
│  │  └────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ tRPC API Calls
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              tRPC API LAYER                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  google_analytics.getConnectionStatus()                                      │
│  ├─► Returns: { status, isHealthy, needsReconnection, warningMessage }      │
│  └─► Used by: Banner, Indicator, Settings                                   │
│                                                                               │
│  google_analytics.testConnection()                                           │
│  ├─► Makes lightweight API call to verify credentials                        │
│  └─► Used by: Settings panel, Debug                                          │
│                                                                               │
│  google_analytics.verifyReconnection()                                       │
│  ├─► Called after OAuth flow completes                                       │
│  └─► Reconciles accounts, checks property                                    │
│                                                                               │
│  google_analytics.listAccounts()                                             │
│  ├─► Enhanced error handling for OAuth errors                                │
│  └─► Throws structured errors with reconnect URLs                            │
│                                                                               │
│  google_analytics.disconnectGoogle()                                         │
│  └─► Allows user to manually disconnect                                      │
│                                                                               │
└────────────────────────────┬─────────────────────────────────────────────────┘
                             │
                             │ Internal Function Calls
                             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         GOOGLE OAUTH CLIENT LAYER                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  getGoogleOAuthClientForUser(userId)                                         │
│  ├─► 1. Fetch account from DB                                                │
│  ├─► 2. Check scopes                                                         │
│  ├─► 3. Check token expiration                                               │
│  ├─► 4. Refresh if needed (with retry)                                       │
│  └─► 5. Return configured OAuth2Client OR throw GoogleOAuthRequired         │
│                                                                               │
│  Error Classification:                                                        │
│  ├─► NO_ACCOUNT: User never connected                                        │
│  ├─► MISSING_SCOPES: Old connection without Analytics                        │
│  ├─► TOKEN_EXPIRED: No refresh token available                               │
│  ├─► TOKEN_REVOKED: Refresh returned invalid_grant                           │
│  └─► REFRESH_FAILED: Other refresh errors                                    │
│                                                                               │
│  checkGoogleConnectionHealth(userId)                                         │
│  ├─► Checks account status WITHOUT making API calls                          │
│  └─► Returns: { status, isHealthy, needsReconnection, ... }                 │
│                                                                               │
│  reconcileGoogleAccount(userId)                                              │
│  ├─► Handles duplicate accounts (edge case)                                  │
│  └─► Ensures user has exactly one Google account                             │
│                                                                               │
└────────────────────────────┬─────────────────────────────────────────────────┘
                             │
                             │ Database Operations
                             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE LAYER                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  accounts table:                                                              │
│  ├─ userId                 (FK to users)                                     │
│  ├─ provider               ("google")                                        │
│  ├─ providerAccountId      (Google's user ID)                                │
│  ├─ access_token           (Short-lived, ~1 hour)                            │
│  ├─ refresh_token          (Long-lived, used to get new access tokens)       │
│  ├─ expires_at             (Unix timestamp)                                  │
│  ├─ scope                  (Space-separated list)                            │
│  ├─ id_token               (JWT with user info)                              │
│  └─ (Optional tracking fields added by Spec 02)                              │
│                                                                               │
│  googleAnalyticsProperties table:                                            │
│  ├─ userId                 (Which user selected this)                        │
│  ├─ propertyResourceName   (e.g., "properties/123456")                       │
│  ├─ selected               (Boolean, one per user)                           │
│  └─ PRESERVED during reconnection ✓                                          │
│                                                                               │
└────────────────────────────┬─────────────────────────────────────────────────┘
                             │
                             │ OAuth Flow
                             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           NEXTAUTH INTEGRATION                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Enhanced signIn Callback:                                                   │
│  ├─► 1. Check if account already exists                                      │
│  ├─► 2. If exists: UPDATE tokens (not create new)                            │
│  ├─► 3. If new: Let adapter create account                                   │
│  └─► 4. Return true (allow sign-in)                                          │
│                                                                               │
│  GoogleProvider Configuration:                                               │
│  ├─► access_type: "offline" (to get refresh_token)                           │
│  ├─► prompt: "consent" (always request fresh tokens)                         │
│  ├─► scope: [..., "analytics.readonly"]                                      │
│  └─► allowDangerousEmailAccountLinking: true                                 │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Reconnection Flow Sequence

```
┌──────┐                ┌─────────┐              ┌──────────┐         ┌──────────┐
│ User │                │ Browser │              │  Server  │         │  Google  │
└──┬───┘                └────┬────┘              └────┬─────┘         └────┬─────┘
   │                         │                        │                    │
   │ Sees "Reconnect" banner │                        │                    │
   ├────────────────────────►│                        │                    │
   │                         │                        │                    │
   │ Clicks [Reconnect]      │                        │                    │
   ├────────────────────────►│                        │                    │
   │                         │                        │                    │
   │                         │ GET /api/auth/signin   │                    │
   │                         │    ?provider=google    │                    │
   │                         ├───────────────────────►│                    │
   │                         │                        │                    │
   │                         │ Redirect to Google     │                    │
   │                         │ OAuth consent screen   │                    │
   │                         ├────────────────────────┼───────────────────►│
   │                         │                        │                    │
   │ Reviews permissions     │                        │                    │
   │ Clicks "Allow"          │                        │                    │
   ├─────────────────────────┼────────────────────────┼───────────────────►│
   │                         │                        │                    │
   │                         │                  Callback with code         │
   │                         │◄───────────────────────┼────────────────────┤
   │                         │                        │                    │
   │                         │                   Exchange code for tokens  │
   │                         │                        ├───────────────────►│
   │                         │                        │                    │
   │                         │                   ◄────┤ Return tokens      │
   │                         │                        │ (access + refresh) │
   │                         │                        │                    │
   │                         │              signIn callback invoked        │
   │                         │                   ├───┐                     │
   │                         │                   │   │ Check if account   │
   │                         │                   │   │ exists for this    │
   │                         │                   │   │ providerAccountId  │
   │                         │                   │◄──┘                     │
   │                         │                   ├───┐                     │
   │                         │                   │   │ UPDATE existing     │
   │                         │                   │   │ account with new   │
   │                         │                   │   │ tokens (not create)│
   │                         │                   │◄──┘                     │
   │                         │                        │                    │
   │                         │ Redirect to app        │                    │
   │                         │ with session cookie    │                    │
   │                         │◄───────────────────────┤                    │
   │                         │                        │                    │
   │                         │ verifyReconnection()   │                    │
   │                         ├───────────────────────►│                    │
   │                         │                   ├───┐                     │
   │                         │                   │   │ Reconcile accounts │
   │                         │                   │   │ Check health       │
   │                         │                   │   │ Verify property    │
   │                         │                   │◄──┘                     │
   │                         │                        │                    │
   │                         │ { success: true }      │                    │
   │                         │◄───────────────────────┤                    │
   │                         │                        │                    │
   │ Banner disappears       │                        │                    │
   │ Indicator turns green   │                        │                    │
   │◄────────────────────────┤                        │                    │
   │                         │                        │                    │
   │ "Show top products"     │                        │                    │
   ├────────────────────────►│ (Chat message)         │                    │
   │                         ├───────────────────────►│                    │
   │                         │                   ├───┐                     │
   │                         │                   │   │ GA4 tool executes  │
   │                         │                   │   │ ✓ Tokens valid     │
   │                         │                   │◄──┘                     │
   │                         │                        ├───────────────────►│
   │                         │                        │ Analytics API call │
   │                         │                   ◄────┤ Success!           │
   │                         │                        │                    │
   │                         │ Stream response        │                    │
   │◄────────────────────────┤ with data             │                    │
   │                         │                        │                    │
```

## Error Flow - Token Expired

```
┌──────┐                ┌─────────┐              ┌──────────┐         ┌──────────┐
│ User │                │ Browser │              │  Server  │         │  Google  │
└──┬───┘                └────┬────┘              └────┬─────┘         └────┬─────┘
   │                         │                        │                    │
   │ "Show top products"     │                        │                    │
   ├────────────────────────►│ (Chat message)         │                    │
   │                         ├───────────────────────►│                    │
   │                         │                        │                    │
   │                         │                   runGaReport()             │
   │                         │                   ├───┐                     │
   │                         │                   │   │ getOAuthClient()   │
   │                         │                   │   │ ├─► Check DB       │
   │                         │                   │   │ ├─► Token expired  │
   │                         │                   │   │ ├─► Try refresh    │
   │                         │                   │   │ └─► Refresh fails! │
   │                         │                   │◄──┘                     │
   │                         │                        │                    │
   │                         │                   throw GoogleOAuthRequired │
   │                         │                   (TOKEN_REVOKED)           │
   │                         │                        │                    │
   │                         │                   Caught in chunk-loop      │
   │                         │                   ├───┐                     │
   │                         │                   │   │ Detect OAuth error │
   │                         │                   │   │ Format user msg    │
   │                         │                   │◄──┘                     │
   │                         │                        │                    │
   │                         │ Tool error message     │                    │
   │                         │ (OAUTH_REQUIRED)       │                    │
   │                         │◄───────────────────────┤                    │
   │                         │                        │                    │
   │                         │                   AI receives error         │
   │                         │                   Responds with explanation │
   │                         │                        │                    │
   │                         │ Stream AI response     │                    │
   │◄────────────────────────┤ + OAuth error component│                    │
   │                         │                        │                    │
   │ Sees friendly message   │                        │                    │
   │ + [Reconnect] button    │                        │                    │
   │◄────────────────────────┤                        │                    │
   │                         │                        │                    │
   │ (Parallel) Status check │                        │                    │
   │                         │ getConnectionStatus()  │                    │
   │                         ├───────────────────────►│                    │
   │                         │ { needsReconnection: true }                 │
   │                         │◄───────────────────────┤                    │
   │                         │                        │                    │
   │ Banner appears at top   │                        │                    │
   │◄────────────────────────┤                        │                    │
   │                         │                        │                    │
```

## Token Refresh Flow (Automatic)

```
┌──────────┐              ┌──────────┐         ┌──────────┐
│  Server  │              │    DB    │         │  Google  │
└────┬─────┘              └────┬─────┘         └────┬─────┘
     │                         │                    │
     │ getOAuthClient()        │                    │
     ├────────────────────────►│                    │
     │                         │                    │
     │ SELECT * FROM accounts  │                    │
     │ WHERE userId = ?        │                    │
     │◄────────────────────────┤                    │
     │                         │                    │
     ├───┐                     │                    │
     │   │ Check expiration    │                    │
     │   │ expires_at < now    │                    │
     │◄──┘ + 60s buffer        │                    │
     │                         │                    │
     ├───┐                     │                    │
     │   │ Needs refresh!      │                    │
     │◄──┘                     │                    │
     │                         │                    │
     │ refreshAccessToken()    │                    │
     ├─────────────────────────┼───────────────────►│
     │                         │                    │
     │                         │   POST /token      │
     │                         │   grant_type=      │
     │                         │   refresh_token    │
     │                         │                    │
     │                    ◄────┼────────────────────┤
     │ New access_token        │                    │
     │ New expires_at          │                    │
     │ (Maybe new refresh_token)                    │
     │                         │                    │
     │ UPDATE accounts         │                    │
     │ SET access_token = ?    │                    │
     │     refresh_token = ?   │                    │
     │     expires_at = ?      │                    │
     ├────────────────────────►│                    │
     │                         │                    │
     │                    ◄────┤                    │
     │ Success                 │                    │
     │                         │                    │
     ├───┐                     │                    │
     │   │ Return OAuth2Client │                    │
     │   │ with fresh tokens   │                    │
     │◄──┘                     │                    │
     │                         │                    │
```

## Component Interaction Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYOUT                            │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ GoogleConnectionBanner                                        │ │
│  │ ┌──────────────────────────────────────────────────────────┐ │ │
│  │ │ useGoogleConnectionStatus()                              │ │ │
│  │ │ ├─► Polls: getConnectionStatus every 5 min              │ │ │
│  │ │ └─► Shows banner if needsReconnection                    │ │ │
│  │ │                                                           │ │ │
│  │ │ useReconnectGoogle()                                     │ │ │
│  │ │ └─► Handles: startReconnection() → OAuth flow           │ │ │
│  │ └──────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────┐  ┌───────────────────────────────────────────┐ │
│  │ AppSidebar     │  │ Main Content Area                         │ │
│  │ ┌────────────┐ │  │ ┌───────────────────────────────────────┐ │ │
│  │ │Connection  │ │  │ │ Chat                                  │ │ │
│  │ │Indicator   │ │  │ │ ┌───────────────────────────────────┐ │ │ │
│  │ │            │ │  │ │ │ ChatErrorBoundary                 │ │ │ │
│  │ │ 🟢 Status  │ │  │ │ │ ├─► Catches OAuth errors          │ │ │ │
│  │ │            │ │  │ │ │ └─► Shows recovery UI             │ │ │ │
│  │ │ [Click to  │ │  │ │ │                                   │ │ │ │
│  │ │  reconnect]│ │  │ │ │ ChatMessage (with OAuth detection)│ │ │ │
│  │ └────────────┘ │  │ │ │ ├─► extractOAuthError()           │ │ │ │
│  │                │  │ │ │ └─► Renders ChatOAuthError if found│ │ │ │
│  │ NavMain        │  │ │ └───────────────────────────────────┘ │ │ │
│  │ NavProjects    │  │ └───────────────────────────────────────┘ │ │
│  │ NavUser        │  │                                           │ │
│  └────────────────┘  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow - Connection Status

```
Frontend Component
       │
       │ calls
       ▼
useGoogleConnectionStatus()
       │
       │ queries (cached, 5min refetch)
       ▼
tRPC: google_analytics.getConnectionStatus
       │
       │ calls
       ▼
checkGoogleConnectionHealth(userId)
       │
       │ SELECT FROM accounts WHERE...
       ▼
Database
       │
       │ returns account data
       ▼
Health Check Logic:
├─► No account? → "not_connected"
├─► Missing scopes? → "missing_scopes"
├─► Token expired & no refresh? → "expired"
├─► Token expiring in < 7 days? → "expiring_soon"
└─► Otherwise → "connected"
       │
       │ returns
       ▼
{
  status: "expired",
  isHealthy: false,
  needsReconnection: true,
  warningMessage: "Your Google connection has expired",
  errorReason: "TOKEN_EXPIRED"
}
       │
       │ updates state
       ▼
Component renders appropriate UI
```

## Legend

```
┌─────────┐
│  Box    │  Component or system boundary
└─────────┘

─────────►  Data flow or function call

├───┐
│   │       Internal logic/decision
│◄──┘

[Button]    User interaction element

🟢 🔴 🟡     Status indicators (healthy, error, warning)

// Comment   Code comment or explanation
```

This architecture ensures:
- ✅ Clear separation of concerns
- ✅ Reusable components
- ✅ Type-safe error handling
- ✅ Minimal database queries (cached status)
- ✅ User-friendly experience
- ✅ No data loss during reconnection
