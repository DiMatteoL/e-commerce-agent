import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { eq, and } from "drizzle-orm";

import { db } from "@/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/server/db/schema";
import { env } from "@/env";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
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
      // Allow account linking for the same email
      allowDangerousEmailAccountLinking: true,
    }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),

    // Handle account updates on reconnection
    async signIn({ user, account }) {
      // If this is a Google OAuth sign-in with account data
      if (
        account?.provider === "google" &&
        account?.providerAccountId &&
        user?.id
      ) {
        try {
          // Check if account already exists
          const existingAccount = await db
            .select()
            .from(accounts)
            .where(
              and(
                eq(accounts.provider, "google"),
                eq(accounts.providerAccountId, account.providerAccountId),
              ),
            )
            .limit(1);

          if (existingAccount.length > 0) {
            // Account exists - update tokens
            // CRITICAL: Update for THIS user only (not just by providerAccountId)
            await db
              .update(accounts)
              .set({
                access_token: account.access_token,
                refresh_token:
                  account.refresh_token ?? existingAccount[0]?.refresh_token,
                expires_at: account.expires_at,
                id_token: account.id_token,
                scope: account.scope,
                token_type: account.token_type,
                session_state:
                  typeof account.session_state === "string"
                    ? account.session_state
                    : null,
              })
              .where(
                and(
                  eq(accounts.userId, user.id), // CRITICAL: Match user ID
                  eq(accounts.provider, "google"),
                  eq(accounts.providerAccountId, account.providerAccountId),
                ),
              );
          }
        } catch (error) {
          console.error("[NextAuth] Error in signIn callback:", error);
          // Don't block sign-in on error - let adapter handle it
        }
      }

      return true; // Allow sign-in
    },
  },
  events: {
    // Optional: Add event handlers here if needed
  },
  debug: process.env.NODE_ENV === "development",
} satisfies NextAuthConfig;
