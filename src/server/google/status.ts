import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { GoogleAuthErrorReason } from "./client";

const GOOGLE_PROVIDER_ID = "google" as const;
const TOKEN_WARNING_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
] as const;

export type ConnectionStatus =
  | "connected"
  | "expired"
  | "expiring_soon"
  | "missing_scopes"
  | "not_connected"
  | "revoked";

export type GoogleConnectionHealth = {
  status: ConnectionStatus;
  isHealthy: boolean;
  needsReconnection: boolean;
  warningMessage?: string;
  errorReason?: GoogleAuthErrorReason;
  expiresAt?: number; // Unix timestamp in seconds
  scopes?: string[];
  connectedAt?: Date;
};

/**
 * Check Google account connection health without making API calls
 */
export async function checkGoogleConnectionHealth(
  userId: string,
): Promise<GoogleConnectionHealth> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, GOOGLE_PROVIDER_ID),
      ),
    );

  // No account connected
  if (!account) {
    return {
      status: "not_connected",
      isHealthy: false,
      needsReconnection: true,
      errorReason: GoogleAuthErrorReason.NO_ACCOUNT,
    };
  }

  // Check scopes
  const hasAllScopes = hasRequiredScopes(account.scope);
  if (!hasAllScopes) {
    return {
      status: "missing_scopes",
      isHealthy: false,
      needsReconnection: true,
      warningMessage: "Missing Google Analytics permissions",
      errorReason: GoogleAuthErrorReason.MISSING_SCOPES,
      scopes: account.scope?.split(" ") ?? [],
    };
  }

  // Check token expiration
  const nowMs = Date.now();
  const expiresAt = account.expires_at;
  const expiryMs = expiresAt ? expiresAt * 1000 : 0;

  // Token expired and no refresh token - CRITICAL ERROR
  if (expiryMs && expiryMs < nowMs && !account.refresh_token) {
    return {
      status: "expired",
      isHealthy: false,
      needsReconnection: true,
      warningMessage: "Your Google connection has expired",
      errorReason: GoogleAuthErrorReason.TOKEN_EXPIRED,
      expiresAt: expiresAt ?? undefined,
    };
  }

  // Token expired but has refresh token - auto-refresh will handle it
  // This is NORMAL - access tokens expire every hour
  // We'll refresh on next API call, so connection is still healthy
  if (expiryMs && expiryMs < nowMs && account.refresh_token) {
    return {
      status: "connected", // Still connected - refresh token is valid
      isHealthy: true, // Healthy - can auto-refresh
      needsReconnection: false,
      expiresAt: expiresAt ?? undefined,
      scopes: account.scope?.split(" ") ?? [],
    };
  }

  // NOTE: We removed "expiring_soon" warning state
  // Users don't need to see warnings as long as auto-refresh works
  // Only show errors when refresh actually fails

  // All good - token is valid and we can refresh
  return {
    status: "connected",
    isHealthy: true,
    needsReconnection: false,
    expiresAt: expiresAt ?? undefined,
    scopes: account.scope?.split(" ") ?? [],
  };
}

function hasRequiredScopes(scope?: string | null): boolean {
  if (!scope) return false;
  const granted = new Set(scope.split(/\s+/).filter(Boolean));
  return REQUIRED_SCOPES.every((s) => granted.has(s));
}

/**
 * Mark account as potentially revoked (for when refresh fails)
 * This clears the refresh token to force reconnection
 */
export async function markAccountAsRevoked(userId: string): Promise<void> {
  await db
    .update(accounts)
    .set({ refresh_token: null })
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, GOOGLE_PROVIDER_ID),
      ),
    );
}
