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
    description:
      "General (non-item) GA4 report. Defaults to totalRevenue with no dimensions. Safe with session/user/event dimensions like date, country, sessionDefaultChannelGroup.",
    schema: z.object({
      dimensions: z.array(z.string().min(1)).max(3).optional(),
      metrics: z.array(z.string().min(1)).max(5).optional(),
      dateRange: dateRangeSchema.optional(),
      limit: z.number().int().min(1).max(1000).optional(),
      orderBy: orderBySchema.optional(),
    }),
  },
);
