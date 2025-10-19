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
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
] as const;

export enum GoogleAuthErrorReason {
  NO_ACCOUNT = "NO_ACCOUNT",
  MISSING_SCOPES = "MISSING_SCOPES",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  REFRESH_FAILED = "REFRESH_FAILED",
  TOKEN_REVOKED = "TOKEN_REVOKED",
}

export type NeedsGoogleOAuthError = {
  code: typeof ERROR_CODE_NEEDS_GOOGLE_OAUTH;
  reason: GoogleAuthErrorReason;
  message: string;
  userMessage: string;
  authorizeUrl: string;
  canRetry: boolean;
};

function buildAuthorizeUrl(callbackUrl: string = DEFAULT_CALLBACK_URL) {
  const params = new URLSearchParams({
    provider: GOOGLE_PROVIDER_ID,
    callbackUrl,
  });
  return `${NEXTAUTH_SIGNIN_PATH}?${params.toString()}`;
}

function getErrorMessages(reason: GoogleAuthErrorReason): {
  message: string;
  userMessage: string;
  canRetry: boolean;
} {
  switch (reason) {
    case GoogleAuthErrorReason.NO_ACCOUNT:
      return {
        message: "No Google account connected",
        userMessage:
          "Please connect your Google account to access Google Analytics features.",
        canRetry: false,
      };
    case GoogleAuthErrorReason.MISSING_SCOPES:
      return {
        message: "Missing required Google Analytics scopes",
        userMessage:
          "Additional permissions are required. Please reconnect your Google account.",
        canRetry: false,
      };
    case GoogleAuthErrorReason.TOKEN_EXPIRED:
      return {
        message: "Access token expired and no refresh token available",
        userMessage:
          "Your Google connection has expired. Please reconnect to continue.",
        canRetry: false,
      };
    case GoogleAuthErrorReason.REFRESH_FAILED:
      return {
        message: "Failed to refresh access token",
        userMessage:
          "Unable to refresh your Google connection. Please reconnect your account.",
        canRetry: false,
      };
    case GoogleAuthErrorReason.TOKEN_REVOKED:
      return {
        message: "Refresh token has been revoked",
        userMessage:
          "Your Google connection was revoked. Please reconnect to restore access.",
        canRetry: false,
      };
    default:
      return {
        message: "Google authentication required",
        userMessage: "Please connect your Google account to continue.",
        canRetry: false,
      };
  }
}

export class GoogleOAuthRequired extends Error {
  code: NeedsGoogleOAuthError["code"] = ERROR_CODE_NEEDS_GOOGLE_OAUTH;
  reason: GoogleAuthErrorReason;
  authorizeUrl: string;
  userMessage: string;
  canRetry: boolean;

  constructor(
    reason: GoogleAuthErrorReason,
    technicalMessage?: string,
    authorizeUrl?: string,
  ) {
    const { message, userMessage, canRetry } = getErrorMessages(reason);
    super(technicalMessage ?? message);
    this.name = "GoogleOAuthRequired";
    this.reason = reason;
    this.userMessage = userMessage;
    this.authorizeUrl = authorizeUrl ?? buildAuthorizeUrl();
    this.canRetry = canRetry;
  }

  toJSON(): NeedsGoogleOAuthError {
    return {
      code: this.code,
      reason: this.reason,
      message: this.message,
      userMessage: this.userMessage,
      authorizeUrl: this.authorizeUrl,
      canRetry: this.canRetry,
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
    throw new GoogleOAuthRequired(GoogleAuthErrorReason.NO_ACCOUNT);
  }

  function hasAllRequiredScopes(scope?: string | null) {
    if (!scope) return false;
    const granted = new Set(scope.split(/\s+/).filter(Boolean));
    return REQUIRED_SCOPES.every((s) => granted.has(s));
  }

  // If required scopes are missing, force re-consent
  if (!hasAllRequiredScopes(account.scope)) {
    throw new GoogleOAuthRequired(GoogleAuthErrorReason.MISSING_SCOPES);
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

  // If we need a refresh but have no refresh token, require reconnect
  if (needsRefresh && !account.refresh_token) {
    throw new GoogleOAuthRequired(GoogleAuthErrorReason.TOKEN_EXPIRED);
  }

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
      const newRefreshToken = credentials.refresh_token ?? null;

      await db
        .update(accounts)
        .set({
          access_token: newAccessToken,
          refresh_token: newRefreshToken ?? undefined,
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
    } catch (err) {
      // If refresh fails (e.g., invalid_grant, revoked), require reconnect
      // Classify error type for better user messaging
      const error = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      const errorCode = error?.response?.data?.error;
      const isRevoked = errorCode === "invalid_grant";

      throw new GoogleOAuthRequired(
        isRevoked
          ? GoogleAuthErrorReason.TOKEN_REVOKED
          : GoogleAuthErrorReason.REFRESH_FAILED,
        error?.message,
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
