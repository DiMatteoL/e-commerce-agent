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
    description:
      "Run a GA4 report. Auto-aligns metric/dimension scope (e.g., adds itemName for itemRevenue or swaps to totalRevenue if no item dimension), caps dimensions to 3, and retries with safe fallbacks. Returns JSON with headers, rows, rowCount, and optional warnings.",
    schema: z.object({
      dimensions: z.array(z.string().min(1)).max(6).optional(),
      metrics: z.array(z.string().min(1)).min(1).max(10),
      dateRange: dateRangeSchema.optional(),
      limit: z.number().int().min(1).max(1000).optional(),
      orderBy: orderBySchema.optional(),
    }),
  },
);
