### Spec 01 – Google Provider Configuration

- **Status**: Proposed
- **Owner**: Platform/AI
- **Last Updated**: 2025-08-14
- **Scope**: Auth backend

### Summary
Add Google as a NextAuth provider with GA4 read scope and offline access so we can retrieve refresh tokens and later call GA4 APIs on behalf of users.

### Changes
- File: `src/server/auth/config.ts`
  - Add `GoogleProvider` from `next-auth/providers/google`.
  - Set authorization params to request a refresh token and prompt consent.
  - Include GA4 readonly scope.

### Implementation Notes
- Provider configuration example:
```ts
import GoogleProvider from "next-auth/providers/google";

export const authConfig = {
  providers: [
    GoogleProvider({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/analytics.readonly",
          ].join(" "),
        },
      },
    }),
    // existing providers (e.g., DiscordProvider)
  ],
  // ... existing config
} satisfies NextAuthConfig;
```
- Tokens will be persisted by the Drizzle adapter into the `accounts` table.

### Acceptance Criteria
- Google is listed on the `/api/auth/signin` page.
- After a successful Google login, an `accounts` row with `provider = 'google'` is created for the user, including `access_token`, `refresh_token` (first grant), `expires_at`, and `scope` containing `analytics.readonly`.
