import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { eq, and, lt, gt, isNotNull } from "drizzle-orm";
import { getGoogleOAuthClientForUser } from "./client";

const GOOGLE_PROVIDER_ID = "google" as const;
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry

/**
 * Proactively refresh tokens that are about to expire
 * Can be called from a cron job or background worker
 *
 * This prevents users from experiencing token expiration errors
 * by refreshing tokens before they expire.
 */
export async function refreshExpiringTokens(): Promise<{
  refreshed: number;
  failed: number;
  skipped: number;
}> {
  const nowTimestamp = Math.floor(Date.now() / 1000);
  const thresholdTimestamp = Math.floor(
    (Date.now() + REFRESH_THRESHOLD_MS) / 1000,
  );

  // Find accounts with tokens expiring soon
  const expiringAccounts = await db
    .select({
      userId: accounts.userId,
      expires_at: accounts.expires_at,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.provider, GOOGLE_PROVIDER_ID),
        gt(accounts.expires_at, nowTimestamp), // Not yet expired
        lt(accounts.expires_at, thresholdTimestamp), // Expiring soon
        isNotNull(accounts.refresh_token), // Has refresh token
      ),
    );

  let refreshed = 0;
  let failed = 0;
  const skipped = 0;

  for (const account of expiringAccounts) {
    if (!account.userId) continue;

    try {
      // This will trigger refresh if needed
      await getGoogleOAuthClientForUser(account.userId);
      refreshed++;
      console.log(`✓ Proactively refreshed tokens for user ${account.userId}`);
    } catch (err) {
      failed++;
      console.error(
        `✗ Failed to proactively refresh for user ${account.userId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { refreshed, failed, skipped };
}

/**
 * Check token refresh status for a user
 * Returns details about token expiration and refresh needs
 */
export type TokenRefreshStatus = {
  needsRefresh: boolean;
  reason?: "expired" | "expiring_soon" | "no_token";
  expiresAt?: number;
  expiresIn?: number; // milliseconds
};

export async function checkTokenRefreshStatus(
  userId: string,
): Promise<TokenRefreshStatus> {
  const [account] = await db
    .select({
      access_token: accounts.access_token,
      expires_at: accounts.expires_at,
      refresh_token: accounts.refresh_token,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")));

  if (!account) {
    return {
      needsRefresh: true,
      reason: "no_token",
    };
  }

  const nowMs = Date.now();
  const expiresAt = account.expires_at;
  const expiryMs = expiresAt ? expiresAt * 1000 : 0;
  const expiresIn = expiryMs - nowMs;

  // No access token
  if (!account.access_token) {
    return {
      needsRefresh: true,
      reason: "no_token",
      expiresAt: expiresAt ?? undefined,
    };
  }

  // Already expired
  if (expiryMs && expiryMs < nowMs) {
    return {
      needsRefresh: true,
      reason: "expired",
      expiresAt: expiresAt ?? undefined,
      expiresIn,
    };
  }

  // Expiring soon (within 5 minutes)
  if (expiresIn < REFRESH_THRESHOLD_MS) {
    return {
      needsRefresh: true,
      reason: "expiring_soon",
      expiresAt: expiresAt ?? undefined,
      expiresIn,
    };
  }

  return {
    needsRefresh: false,
    expiresAt: expiresAt ?? undefined,
    expiresIn,
  };
}
