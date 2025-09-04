import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { dateRangeSchema, orderBySchema, runGaReportCore } from "./core";

export const gaItemReportTool = tool(
  async ({
    dimensions = ["itemName"],
    metrics = ["itemRevenue"],
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
    name: "ga_item_report",
    description:
      "Item-scoped GA4 report. Defaults to itemRevenue by itemName. Use only item dimensions (itemName, itemId, itemBrand, itemCategory, itemVariant).",
    schema: z.object({
      dimensions: z.array(z.string().min(1)).max(3).optional(),
      metrics: z.array(z.string().min(1)).max(5).optional(),
      dateRange: dateRangeSchema.optional(),
      limit: z.number().int().min(1).max(1000).optional(),
      orderBy: orderBySchema.optional(),
    }),
  },
);
