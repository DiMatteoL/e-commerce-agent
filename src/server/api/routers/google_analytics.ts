import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { db } from "@/server/db";
import {
  googleAnalyticsAccounts,
  googleAnalyticsProperties,
} from "@/server/db/schema";
import { listAccountsWithPropertiesAndStreams } from "@/server/google/properties";
import { persistGaAccountsAndPropertiesIfMissing } from "@/server/google/persist";

export const googleAnalyticsRouter = createTRPCRouter({
  selectProperty: protectedProcedure
    .input(z.object({ propertyResourceName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const result = await db.transaction(async (tx) => {
        await tx
          .update(googleAnalyticsProperties)
          .set({ selected: false })
          .where(eq(googleAnalyticsProperties.userId, userId));

        const updateRes = await tx
          .update(googleAnalyticsProperties)
          .set({ selected: true })
          .where(
            and(
              eq(googleAnalyticsProperties.userId, userId),
              eq(
                googleAnalyticsProperties.propertyResourceName,
                input.propertyResourceName,
              ),
            ),
          )
          .returning({ id: googleAnalyticsProperties.id });

        if (updateRes.length === 0) {
          throw new Error("PROPERTY_NOT_FOUND");
        }

        return updateRes[0];
      });

      if (!result) {
        throw new Error("FAILED_TO_SELECT_PROPERTY");
      }

      return { ok: true, selectedId: result.id };
    }),
  getSelectedProperty: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      return {
        userConnected: false,
        property: null as null | {
          propertyDisplayName: string | null;
          propertyResourceName: string;
          accountDisplayName: string | null;
        },
      };
    }

    const rows = await db
      .select({
        propertyDisplayName: googleAnalyticsProperties.propertyDisplayName,
        propertyResourceName: googleAnalyticsProperties.propertyResourceName,
        accountDisplayName: googleAnalyticsAccounts.accountDisplayName,
      })
      .from(googleAnalyticsProperties)
      .innerJoin(
        googleAnalyticsAccounts,
        eq(googleAnalyticsProperties.accountId, googleAnalyticsAccounts.id),
      )
      .where(
        and(
          eq(googleAnalyticsProperties.userId, userId),
          eq(googleAnalyticsProperties.selected, true),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return { userConnected: true, property: null };
    }

    return {
      userConnected: true,
      property: row,
    };
  }),
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    try {
      const accounts = await listAccountsWithPropertiesAndStreams(userId);
      // Persist to DB to ensure properties exist for selection
      await persistGaAccountsAndPropertiesIfMissing(userId, accounts);
      return accounts;
    } catch (_err) {
      // If user is disconnected from Google or an API error occurs, return empty array
      return [] as const;
    }
  }),
});
