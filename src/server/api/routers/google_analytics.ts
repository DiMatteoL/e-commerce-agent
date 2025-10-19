import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { analyticsadmin_v1beta } from "googleapis";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { db } from "@/server/db";
import {
  accounts,
  googleAnalyticsAccounts,
  googleAnalyticsProperties,
} from "@/server/db/schema";
import { listAccountsWithPropertiesAndStreams } from "@/server/google/properties";
import { persistGaAccountsAndPropertiesIfMissing } from "@/server/google/persist";
import { TRPCError } from "@trpc/server";
import {
  GoogleOAuthRequired,
  getGoogleOAuthClientForUser,
} from "@/server/google/client";
import { handleGoogleOAuthError } from "@/server/api/errors";
import { checkGoogleConnectionHealth } from "@/server/google/status";

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
    } catch (err) {
      // Handle OAuth errors with full metadata preservation
      if (err instanceof GoogleOAuthRequired) {
        handleGoogleOAuthError(err);
      }

      // Best-effort classification of googleapis errors
      const e = err as {
        code?: number | string;
        status?: number | string;
        message?: string;
      } | null;

      const statusCode = Number(e?.code ?? e?.status ?? 0);
      const message = e?.message ?? (err instanceof Error ? err.message : "");

      const isUnauthorized =
        statusCode === 401 ||
        (typeof message === "string" && message.includes("Login Required"));
      if (isUnauthorized) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Google session expired or missing permissions. Please reconnect Google and try again.",
          cause: err as Error,
        });
      }

      const apiNotEnabled =
        typeof message === "string" &&
        (message.includes("has not been used in project") ||
          message.includes("Google Analytics Admin API") ||
          message.includes("analyticsadmin.googleapis.com") ||
          message.includes("Google Analytics Data API") ||
          message.includes("analyticsdata.googleapis.com"));
      if (apiNotEnabled) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Google Analytics API is not enabled for this project. Please enable the Admin and Data APIs in Google Cloud, then reconnect.",
          cause: err as Error,
        });
      }

      if (
        statusCode === 403 ||
        (typeof message === "string" && message.includes("PERMISSION_DENIED"))
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Google account lacks permission to access these Analytics properties. Please ensure you have at least Viewer access, then reconnect.",
          cause: err as Error,
        });
      }

      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: message || "Failed to list Google Analytics accounts.",
        cause: err as Error,
      });
    }
  }),

  /**
   * Check Google account connection health
   * Returns status without making external API calls
   */
  getConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const health = await checkGoogleConnectionHealth(userId);
    return health;
  }),

  /**
   * Test Google connection by making a lightweight API call
   * This actually validates that the credentials work
   */
  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    try {
      // Try to get the OAuth client - this will attempt token refresh if needed
      const client = await getGoogleOAuthClientForUser(userId);

      // Make a lightweight API call to verify credentials
      const analyticsAdmin = new analyticsadmin_v1beta.Analyticsadmin({
        auth: client,
      });

      // List account summaries is a lightweight call
      await analyticsAdmin.accountSummaries.list({ pageSize: 1 });

      return {
        success: true,
        message: "Google connection is working",
      };
    } catch (err) {
      if (err instanceof GoogleOAuthRequired) {
        handleGoogleOAuthError(err);
      }

      return {
        success: false,
        message: err instanceof Error ? err.message : "Connection test failed",
      };
    }
  }),

  /**
   * Force disconnect Google account
   * Useful for testing and user-initiated disconnection
   */
  disconnectGoogle: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    await db
      .delete(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")));

    return { success: true };
  }),
});
