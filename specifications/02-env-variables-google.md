### Spec 02 – Environment Variables for Google OAuth

- **Status**: Proposed
- **Owner**: Platform/Infra
- **Last Updated**: 2025-08-14
- **Scope**: Configuration

### Summary
Add required env variables for Google OAuth and ensure they are validated at runtime.

### Changes
- File: `src/env.js`
  - Add `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` to the server schema and runtime mapping.

### Implementation Notes
- Schema additions:
```ts
export const env = createEnv({
  server: {
    // ...existing
    AUTH_GOOGLE_ID: z.string(),
    AUTH_GOOGLE_SECRET: z.string(),
  },
  runtimeEnv: {
    // ...existing
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
  },
});
```
- Provide values via `.env.local` or deployment secrets.

### Acceptance Criteria
- Build/runtime fails clearly if `AUTH_GOOGLE_ID` or `AUTH_GOOGLE_SECRET` are missing (unless `SKIP_ENV_VALIDATION` is set).
- `authConfig` can read `env.AUTH_GOOGLE_ID/SECRET` without undefined errors.
