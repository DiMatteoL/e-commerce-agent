import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { dateRangeSchema, runGaReportCore } from "./core";

export const gaTotalRevenueTool = tool(
  async ({ dateRange, limit }) => {
    return runGaReportCore({
      dimensions: [],
      metrics: ["totalRevenue"],
      dateRange,
      limit,
    });
  },
  {
    name: "ga_total_revenue",
    description: "Total revenue for the date range. No dimensions.",
    schema: z.object({
      dateRange: dateRangeSchema.optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    }),
  },
);

export const gaRevenueByDateTool = tool(
  async ({ dateRange, limit }) => {
    return runGaReportCore({
      dimensions: ["date"],
      metrics: ["totalRevenue"],
      dateRange,
      limit,
    });
  },
  {
    name: "ga_revenue_by_date",
    description: "Total revenue by date (trend).",
    schema: z.object({
      dateRange: dateRangeSchema.optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    }),
  },
);

export const gaPurchasesByChannelTool = tool(
  async ({ dateRange, limit }) => {
    return runGaReportCore({
      dimensions: ["sessionDefaultChannelGroup"],
      metrics: ["purchases"],
      dateRange,
      limit,
    });
  },
  {
    name: "ga_purchases_by_channel",
    description: "Purchases by session default channel group.",
    schema: z.object({
      dateRange: dateRangeSchema.optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    }),
  },
);
