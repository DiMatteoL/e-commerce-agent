import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { dateRangeSchema, orderBySchema, runGaReportCore } from "./core";

export const gaGeneralReportTool = tool(
  async ({
    dimensions = [],
    metrics = ["totalRevenue"],
    dateRange,
    limit,
    orderBy,
  }) => {
    return runGaReportCore({
      dimensions,
      metrics,
      dateRange,
      limit,
      orderBy,
    });
  },
  {
    name: "ga_general_report",
    description: `General (non-item) GA4 report for property-level, user-scoped, and session-scoped metrics.

USE THIS FOR: activeUsers, totalUsers, sessions, engagedSessions, totalRevenue, purchases, conversions, bounceRate
COMPATIBLE DIMENSIONS: date, country, city, deviceCategory, sessionDefaultChannelGroup, sessionSource, sessionMedium, browser, newVsReturning

❌ DO NOT USE with item dimensions (itemName, itemId, itemBrand) - these are incompatible with user/session metrics
❌ DO NOT USE for item-scoped metrics (itemRevenue, itemsViewed) - use ga_item_report instead

Example: "activeUsers by date" ✅ | "sessions by deviceCategory" ✅ | "activeUsers by itemName" ❌`,
    schema: z.object({
      dimensions: z.array(z.string().min(1)).max(3).optional(),
      metrics: z.array(z.string().min(1)).max(5).optional(),
      dateRange: dateRangeSchema.optional(),
      limit: z.number().int().min(1).max(1000).optional(),
      orderBy: orderBySchema.optional(),
    }),
  },
);
