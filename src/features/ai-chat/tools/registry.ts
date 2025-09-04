import {
  gaPurchasesByChannelTool,
  gaRevenueByDateTool,
  gaTotalRevenueTool,
} from "@/features/ai-chat/tools/ga4/curated";
import { gaGeneralReportTool } from "@/features/ai-chat/tools/ga4/general-report";
import { gaItemReportTool } from "@/features/ai-chat/tools/ga4/item-report";
import { gaRunReportTool } from "@/features/ai-chat/tools/ga4/run-report";
import type { StructuredTool } from "@langchain/core/tools";

export const tools: StructuredTool[] = [
  gaRunReportTool as unknown as StructuredTool,
  gaItemReportTool as unknown as StructuredTool,
  gaGeneralReportTool as unknown as StructuredTool,
  gaTotalRevenueTool as unknown as StructuredTool,
  gaRevenueByDateTool as unknown as StructuredTool,
  gaPurchasesByChannelTool as unknown as StructuredTool,
];

export const toolByName = new Map<string, StructuredTool>(
  tools.map((t) => [t.name, t] as const),
);
