### Spec 04 – Google Client Helper

- **Status**: Proposed
- **Owner**: Platform/Backend
- **Last Updated**: 2025-08-14
- **Scope**: Server utilities

### Summary
Introduce a helper to construct authenticated Google clients for a user, handling token expiration and refresh transparently and persisting updated tokens.

### Changes
- New file: `src/server/google/client.ts`
  - `getGoogleOAuthClientForUser(userId: string)`
  - `getAnalyticsDataClient(userId: string)`
  - `getAnalyticsAdminClient(userId: string)`

### Implementation Notes
- Use `google-auth-library` or `googleapis` OAuth2 client.
- Lookup `account` by `{ provider: 'google', userId }`.
- If no account found → throw error per Spec 06 (`code: 'NEEDS_GOOGLE_OAUTH'`).
- If token expired/near expiry → refresh using `refresh_token`, update DB: `access_token`, `expires_at`, and optionally `id_token`, `scope`, `token_type`.
- Return ready-to-use clients:
```ts
import { google } from "googleapis";

export async function getAnalyticsDataClient(userId: string) {
  const oauth2 = await getGoogleOAuthClientForUser(userId);
  return google.analyticsdata({ version: "v1", auth: oauth2 });
}
```

### Acceptance Criteria
- Valid user returns authenticated clients capable of calling GA4 APIs.
- Missing connection throws a typed error (`NEEDS_GOOGLE_OAUTH`).
- Expired tokens are refreshed and persisted automatically.

### Tests
- **Missing account**: Call helper with a user having no Google account → throws `NEEDS_GOOGLE_OAUTH` with `authorizeUrl`.
- **Valid tokens**: With a seeded valid token row → helper returns client; a simple `GET` (e.g., list properties) succeeds.
- **Expired tokens**: Seed `expires_at` in the past + valid `refresh_token` → helper refreshes; DB `access_token` and `expires_at` updated.
- **Refresh failure**: Invalid refresh token → surfaces an error with guidance to re-consent; tokens are not corrupted.
