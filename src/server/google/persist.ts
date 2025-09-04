import { inArray } from "drizzle-orm";

import { db } from "@/server/db";
import {
  googleAnalyticsAccounts,
  googleAnalyticsProperties,
} from "@/server/db/schema";
import type { Ga4AccountSummary } from "@/server/google/properties";

export async function persistGaAccountsAndPropertiesIfMissing(
  userId: string,
  accounts: Ga4AccountSummary[],
) {
  // Existing accounts for this user
  const existingAccounts = await db
    .select({
      id: googleAnalyticsAccounts.id,
      accountResourceName: googleAnalyticsAccounts.accountResourceName,
    })
    .from(googleAnalyticsAccounts)
    .where(inArray(googleAnalyticsAccounts.userId, [userId]));

  const accountResourceToId = new Map<string, number>();
  for (const acc of existingAccounts)
    accountResourceToId.set(acc.accountResourceName, acc.id);

  const missingAccounts = accounts.filter(
    (a) => !accountResourceToId.has(a.accountResourceName),
  );

  if (missingAccounts.length > 0) {
    const inserted = await db
      .insert(googleAnalyticsAccounts)
      .values(
        missingAccounts.map((a) => ({
          userId,
          accountResourceName: a.accountResourceName,
          accountDisplayName: a.accountDisplayName ?? null,
        })),
      )
      .returning({
        id: googleAnalyticsAccounts.id,
        accountResourceName: googleAnalyticsAccounts.accountResourceName,
      });
    for (const row of inserted)
      accountResourceToId.set(row.accountResourceName, row.id);
  }

  // Existing properties for this user
  const existingProperties = await db
    .select({
      propertyResourceName: googleAnalyticsProperties.propertyResourceName,
    })
    .from(googleAnalyticsProperties)
    .where(inArray(googleAnalyticsProperties.userId, [userId]));
  const existingPropertySet = new Set(
    existingProperties.map((p) => p.propertyResourceName),
  );

  // Prepare property rows to insert
  const propertiesToInsert: Array<{
    userId: string;
    accountId: number;
    propertyResourceName: string;
    propertyId: string | null;
    propertyDisplayName: string | null;
  }> = [];

  for (const acct of accounts) {
    const accountId = accountResourceToId.get(acct.accountResourceName);
    if (!accountId) continue; // Should not happen; skip defensively

    for (const prop of acct.properties) {
      if (existingPropertySet.has(prop.propertyResourceName)) continue;
      propertiesToInsert.push({
        userId,
        accountId,
        propertyResourceName: prop.propertyResourceName,
        propertyId: prop.propertyId ?? null,
        propertyDisplayName: prop.propertyDisplayName ?? null,
      });
    }
  }

  if (propertiesToInsert.length > 0) {
    await db.insert(googleAnalyticsProperties).values(propertiesToInsert);
  }
}
