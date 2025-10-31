import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { dateRangeSchema, orderBySchema, runGaReportCore } from "./core";

export const gaEventReportTool = tool(
  async ({
    eventName,
    additionalDimensions = [],
    additionalMetrics = [],
    dateRange,
    limit,
    orderBy,
  }) => {
    const dimensions = eventName ? ["eventName", ...additionalDimensions] : additionalDimensions;
    const metrics = ["eventCount", ...additionalMetrics];

    return runGaReportCore({
      dimensions,
      metrics,
      dateRange,
      limit,
      orderBy,
    });
  },
  {
    name: "ga_event_report",
    description: `Query GA4 custom events and event counts.

USE THIS FOR:
- Custom conversion events (e.g., "order_completed", "purchase_confirmed", "checkout_complete")
- Tracking specific user actions by event name
- When standard metrics like "purchases" aren't available but custom events are tracked
- Finding out what events are being tracked (query all events by not filtering eventName)

IMPORTANT: Many sites track purchases as custom events instead of using GA4's standard "purchase" event.
If "purchases" metric fails, use this tool to:
1. Query all events to see what's tracked: don't pass eventName parameter
2. Look for purchase-related events in the results
3. Query that specific event: pass the eventName you found

Examples:
- "All tracked events" → eventName: null, additionalDimensions: []
- "Custom purchase event" → eventName: "order_completed", additionalDimensions: ["sessionSource"]
- "Form submissions by source" → eventName: "form_submit", additionalDimensions: ["sessionSource"]

COMPATIBLE ADDITIONAL DIMENSIONS: date, country, city, deviceCategory, sessionSource, sessionMedium, sessionDefaultChannelGroup, browser`,
    schema: z.object({
      eventName: z
        .string()
        .optional()
        .describe(
          'Specific event name to filter (e.g., "purchase", "order_completed"). Leave empty to see all events.',
        ),
      additionalDimensions: z
        .array(z.string().min(1))
        .max(2)
        .optional()
        .describe(
          'Additional dimensions like "date", "sessionSource", "deviceCategory" (max 2 additional)',
        ),
      additionalMetrics: z
        .array(z.string().min(1))
        .max(3)
        .optional()
        .describe(
          'Additional metrics beyond eventCount (e.g., "totalRevenue" if applicable)',
        ),
      dateRange: dateRangeSchema.optional(),
      limit: z.number().int().min(1).max(1000).optional(),
      orderBy: orderBySchema.optional(),
    }),
  },
);
