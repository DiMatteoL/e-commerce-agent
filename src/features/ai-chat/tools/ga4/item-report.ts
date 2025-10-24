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
    description: `Item-scoped GA4 report for product/item-level analysis. Defaults to itemRevenue by itemName.

USE THIS FOR: itemRevenue, itemsViewed, itemsAddedToCart, itemsCheckedOut, itemsPurchased, itemPurchaseQuantity
REQUIRED: Must include at least ONE item dimension (itemName, itemId, itemBrand, itemCategory)
OPTIONAL: Can add date, country, sessionSource for additional breakdowns

Example: "itemRevenue by itemName" ✅ | "top products by revenue" ✅ | "items viewed by product and date" ✅
❌ DO NOT USE for user metrics (activeUsers, totalUsers, sessions) - use ga_general_report instead`,
    schema: z.object({
      dimensions: z.array(z.string().min(1)).max(3).optional(),
      metrics: z.array(z.string().min(1)).max(5).optional(),
      dateRange: dateRangeSchema.optional(),
      limit: z.number().int().min(1).max(1000).optional(),
      orderBy: orderBySchema.optional(),
    }),
  },
);
