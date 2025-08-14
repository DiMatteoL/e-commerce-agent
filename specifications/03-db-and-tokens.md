### Spec 03 – Database and Tokens

- **Status**: Proposed
- **Owner**: Platform/Backend
- **Last Updated**: 2025-08-14
- **Scope**: Auth storage

### Summary
Use existing Drizzle/NextAuth schema to store Google OAuth tokens. No migrations required.

### Current Schema
- File: `src/server/db/schema.ts`
  - Table `account` already includes: `access_token`, `refresh_token`, `expires_at`, `id_token`, `scope`, `token_type`.
  - Drizzle adapter mapping is already configured in `src/server/auth/config.ts`.

### Behavior
- On Google sign-in, NextAuth persists provider account data into `account`.
- On token refresh (Spec 04), new tokens overwrite `access_token`/`expires_at`; `refresh_token` may be updated if the provider returns a new one.

### Acceptance Criteria
- First Google consent produces an `account` row with `provider='google'` and populated token fields.
- Subsequent refresh operations can update `access_token` and `expires_at` values.

### Tests
- **Insert on sign-in**: After OAuth (Spec 01), verify DB row existence and token fields are non-null as expected.
- **Update on refresh**: Simulate a refresh via the client helper (Spec 04) and verify `access_token` and `expires_at` changed; `refresh_token` remains or updates if provided.
- **Index usage**: Query by `provider, providerAccountId` primary key succeeds; `account_user_id_idx` supports lookups by `userId`.
