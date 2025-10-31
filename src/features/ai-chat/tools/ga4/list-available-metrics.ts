import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { auth } from "@/server/auth";
import { resolvePropertyResourceName } from "./core";
import { getAnalyticsDataClient } from "@/server/google/client";

type GaMetadata = {
  dimensions?: Array<{
    apiName?: string | null;
    uiName?: string | null;
    description?: string | null;
  }>;
  metrics?: Array<{
    apiName?: string | null;
    uiName?: string | null;
    description?: string | null;
  }>;
};

export const gaListAvailableMetricsTool = tool(
  async ({ searchTerm }) => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new Error("UNAUTHENTICATED");

    const propertyResourceName = await resolvePropertyResourceName(userId);
    const dataClient = await getAnalyticsDataClient(userId);

    // Extract property ID from resource name (e.g., "properties/316678865" -> "316678865")
    const propertyId = propertyResourceName.split("/")[1];

    const resp = await (
      dataClient.properties as unknown as {
        getMetadata: (params: {
          name: string;
        }) => Promise<{ data: GaMetadata }>;
      }
    ).getMetadata({ name: `properties/${propertyId}/metadata` });

    const data: GaMetadata = resp.data ?? {};

    let metrics = (data.metrics ?? [])
      .map((m) => ({
        apiName: m.apiName ?? "",
        uiName: m.uiName ?? "",
        description: m.description ?? "",
      }))
      .filter((m) => m.apiName.length > 0);

    let dimensions = (data.dimensions ?? [])
      .map((d) => ({
        apiName: d.apiName ?? "",
        uiName: d.uiName ?? "",
        description: d.description ?? "",
      }))
      .filter((d) => d.apiName.length > 0);

    // Filter by search term if provided
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      metrics = metrics.filter(
        (m) =>
          m.apiName.toLowerCase().includes(term) ||
          m.uiName.toLowerCase().includes(term) ||
          m.description.toLowerCase().includes(term),
      );
      dimensions = dimensions.filter(
        (d) =>
          d.apiName.toLowerCase().includes(term) ||
          d.uiName.toLowerCase().includes(term) ||
          d.description.toLowerCase().includes(term),
      );
    }

    return JSON.stringify(
      {
        propertyResourceName,
        totalMetrics: data.metrics?.length ?? 0,
        totalDimensions: data.dimensions?.length ?? 0,
        metrics: metrics.slice(0, 50), // Limit to 50 to avoid overwhelming the AI
        dimensions: dimensions.slice(0, 50),
        note: searchTerm
          ? `Filtered by search term: "${searchTerm}". Use this tool again without searchTerm to see all available metrics.`
          : "Showing up to 50 metrics and 50 dimensions. Use searchTerm parameter to filter (e.g., 'purchase', 'revenue', 'conversion').",
      },
      null,
      2,
    );
  },
  {
    name: "ga_list_available_metrics",
    description: `Lists all metrics and dimensions available in the current GA4 property.

USE THIS WHEN:
- A metric you tried to use is not found ("Dropped unknown field" error)
- You need to discover what conversion/purchase metrics are available
- The user asks "what data do we have?" or "what can I analyze?"
- You want to find alternative metrics (e.g., searching for "purchase" or "revenue")

IMPORTANT: Different GA4 properties have different metrics depending on:
- E-commerce tracking setup (standard vs. custom events)
- Custom event definitions
- Enhanced measurement settings
- BigQuery exports

If a metric isn't available, use this tool to find alternatives.
The searchTerm parameter is optional but highly recommended (e.g., "purchase", "revenue", "conversion", "cart").`,
    schema: z.object({
      searchTerm: z
        .string()
        .optional()
        .describe(
          'Optional search term to filter metrics/dimensions (e.g., "purchase", "revenue", "conversion", "item", "cart")',
        ),
    }),
  },
);
