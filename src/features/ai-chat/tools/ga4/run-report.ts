import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { dateRangeSchema, orderBySchema, runGaReportCore } from "./core";

export const gaRunReportTool = tool(
  async ({ dimensions = [], metrics, dateRange, limit = 50, orderBy }) => {
    return runGaReportCore({
      dimensions,
      metrics,
      dateRange,
      limit,
      orderBy,
    });
  },
  {
    name: "ga_run_report",
    description: `Advanced GA4 report with automatic scope alignment and fallback handling.

FEATURES:
- Auto-adds itemName dimension for item-scoped metrics (itemRevenue, itemsViewed)
- Auto-removes item dimensions from user/session metrics (activeUsers, sessions)
- Caps dimensions to 3 for API compatibility
- Retries with safe fallbacks on errors

SCOPE RULES (CRITICAL):
- User metrics (activeUsers, totalUsers) ❌ INCOMPATIBLE with item dimensions (itemName)
- Item metrics (itemRevenue, itemsViewed) ✅ REQUIRE item dimensions (itemName, itemId)
- Session metrics (sessions) work with session/user dimensions, NOT item dimensions

PREFER using ga_general_report or ga_item_report for simpler, more predictable behavior.
Use this only for complex custom queries where you need fine control.`,
    schema: z.object({
      dimensions: z.array(z.string().min(1)).max(6).optional(),
      metrics: z.array(z.string().min(1)).min(1).max(10),
      dateRange: dateRangeSchema.optional(),
      limit: z.number().int().min(1).max(1000).optional(),
      orderBy: orderBySchema.optional(),
    }),
  },
);
