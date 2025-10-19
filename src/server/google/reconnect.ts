import { eq, and, desc } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";

/**
 * Ensures user has exactly one Google account with latest tokens
 * Handles edge cases where duplicates might exist
 */
export async function reconcileGoogleAccount(userId: string): Promise<void> {
  const googleAccounts = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")))
    .orderBy(desc(accounts.expires_at)); // Most recent first

  // If multiple accounts exist (shouldn't happen, but handle it)
  if (googleAccounts.length > 1) {
    const primary = googleAccounts[0];
    const duplicates = googleAccounts.slice(1);

    if (!primary) {
      return;
    }

    // Delete duplicates
    for (const dup of duplicates) {
      await db
        .delete(accounts)
        .where(
          and(
            eq(accounts.provider, "google"),
            eq(accounts.providerAccountId, dup.providerAccountId),
            eq(accounts.userId, userId),
          ),
        );
    }
  }
}

/**
 * Check if user has a valid Google account connection
 */
export async function hasValidGoogleConnection(
  userId: string,
): Promise<boolean> {
  const [account] = await db
    .select({
      refresh_token: accounts.refresh_token,
      expires_at: accounts.expires_at,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")))
    .limit(1);

  if (!account) return false;

  // Has refresh token OR has non-expired access token
  const now = Math.floor(Date.now() / 1000);
  return !!(
    account.refresh_token ||
    (account.expires_at && account.expires_at > now)
  );
}
