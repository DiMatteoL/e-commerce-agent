import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { googleAnalyticsProperties } from "@/server/db/schema";

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

      return { ok: true, selectedId: result.id };
    }),
});
