import { and, eq } from "drizzle-orm";
import {
  google,
  analyticsadmin_v1beta,
  analyticsdata_v1beta,
} from "googleapis";

import { env } from "@/env";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";

const GOOGLE_PROVIDER_ID = "google" as const;
const NEXTAUTH_SIGNIN_PATH = "/api/auth/signin" as const;
const DEFAULT_CALLBACK_URL = "/" as const;
const ERROR_CODE_NEEDS_GOOGLE_OAUTH = "NEEDS_GOOGLE_OAUTH" as const;
const TOKEN_REFRESH_SKEW_MS = 60_000; // 1 minute skew

export type NeedsGoogleOAuthError = {
  code: typeof ERROR_CODE_NEEDS_GOOGLE_OAUTH;
  message: string;
  authorizeUrl: string;
};

function buildAuthorizeUrl(callbackUrl: string = DEFAULT_CALLBACK_URL) {
  const params = new URLSearchParams({
    provider: GOOGLE_PROVIDER_ID,
    callbackUrl,
  });
  return `${NEXTAUTH_SIGNIN_PATH}?${params.toString()}`;
}

export class GoogleOAuthRequired extends Error {
  code: NeedsGoogleOAuthError["code"] = ERROR_CODE_NEEDS_GOOGLE_OAUTH;
  authorizeUrl: string;

  constructor(
    message = "Connect Google to use GA4 tools.",
    authorizeUrl?: string,
  ) {
    super(message);
    this.name = "GoogleOAuthRequired";
    this.authorizeUrl = authorizeUrl ?? buildAuthorizeUrl();
  }

  toJSON(): NeedsGoogleOAuthError {
    return {
      code: this.code,
      message: this.message,
      authorizeUrl: this.authorizeUrl,
    };
  }
}

export async function getGoogleOAuthClientForUser(userId: string) {
  // Lookup the user's Google account row
  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, GOOGLE_PROVIDER_ID),
      ),
    );

  if (!account) {
    throw new GoogleOAuthRequired();
  }

  const oauth2 = new google.auth.OAuth2({
    clientId: env.AUTH_GOOGLE_ID,
    clientSecret: env.AUTH_GOOGLE_SECRET,
  });

  oauth2.setCredentials({
    access_token: account.access_token ?? undefined,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    scope: account.scope ?? undefined,
    token_type: account.token_type ?? undefined,
    id_token: account.id_token ?? undefined,
  });

  // If token is missing or expired/near expiry, refresh using the refresh_token
  const nowMs = Date.now();
  const expiryMs = account.expires_at ? account.expires_at * 1000 : 0;
  const needsRefresh =
    !account.access_token ||
    (expiryMs && expiryMs - nowMs < TOKEN_REFRESH_SKEW_MS);

  if (needsRefresh && account.refresh_token) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();

      // Persist updated tokens
      const newAccessToken = credentials.access_token ?? null;
      const newIdToken = credentials.id_token ?? null;
      const newScope = credentials.scope ?? null;
      const newTokenType = credentials.token_type ?? null;
      const newExpiresAt = credentials.expiry_date
        ? Math.floor(credentials.expiry_date / 1000)
        : null;

      await db
        .update(accounts)
        .set({
          access_token: newAccessToken,
          id_token: newIdToken,
          scope: newScope,
          token_type: newTokenType,
          expires_at: newExpiresAt ?? undefined,
        })
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.provider, GOOGLE_PROVIDER_ID),
          ),
        );

      // Update local credentials so returned client is ready
      oauth2.setCredentials({
        access_token: credentials.access_token,
        refresh_token:
          credentials.refresh_token ?? account.refresh_token ?? undefined,
        id_token: credentials.id_token,
        scope: credentials.scope,
        token_type: credentials.token_type,
        expiry_date: credentials.expiry_date,
      });
    } catch (_) {
      throw new Error(
        "Failed to refresh Google access token. Please reconnect Google to continue.",
      );
    }
  }

  return oauth2;
}

export async function getAnalyticsDataClient(userId: string) {
  const auth = await getGoogleOAuthClientForUser(userId);
  return new analyticsdata_v1beta.Analyticsdata({ auth });
}

export async function getAnalyticsAdminClient(userId: string) {
  const auth = await getGoogleOAuthClientForUser(userId);
  return new analyticsadmin_v1beta.Analyticsadmin({ auth });
}
