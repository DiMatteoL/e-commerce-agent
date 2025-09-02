import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { analyticsdata_v1beta } from "googleapis";
import { and, eq } from "drizzle-orm";

import { getAnalyticsDataClient } from "@/server/google/client";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { googleAnalyticsProperties } from "@/server/db/schema";

// KISS stable stringify
function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = (obj as any)[k];
  return JSON.stringify(sorted);
}

// Tiny in-module TTL cache
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: string; expiresAt: number }>();
function getCached(key: string): string | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}
function setCached(key: string, value: string, ttlMs: number = CACHE_TTL_MS) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// Resolve the property resource name for this user, verifying ownership
async function resolvePropertyResourceName(
  userId: string,
  propertyId?: string,
): Promise<string> {
  if (propertyId) {
    const rows = await db
      .select({ resource: googleAnalyticsProperties.propertyResourceName })
      .from(googleAnalyticsProperties)
      .where(
        and(
          eq(googleAnalyticsProperties.userId, userId),
          eq(googleAnalyticsProperties.propertyId, propertyId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) throw new Error("PROPERTY_NOT_OWNED");
    return row.resource;
  }

  const selected = await db
    .select({ resource: googleAnalyticsProperties.propertyResourceName })
    .from(googleAnalyticsProperties)
    .where(
      and(
        eq(googleAnalyticsProperties.userId, userId),
        eq(googleAnalyticsProperties.selected, true),
      ),
    )
    .limit(1);
  const row = selected[0];
  if (!row) throw new Error("NO_SELECTED_PROPERTY");
  return row.resource;
}

const orderBySchema = z.object({
  metric: z.string().min(1),
  desc: z.boolean().optional(),
});

const dateRangeSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export const gaRunReportTool = tool(
  async ({
    propertyId,
    dimensions = [],
    metrics,
    dateRange = { startDate: "28daysAgo", endDate: "yesterday" },
    limit = 50,
    orderBy,
  }) => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new Error("UNAUTHENTICATED");

    const propertyResourceName = await resolvePropertyResourceName(
      userId,
      propertyId,
    );

    const requestBody: analyticsdata_v1beta.Schema$RunReportRequest = {
      dateRanges: [dateRange],
      dimensions: (dimensions ?? []).map((name) => ({ name })),
      metrics: metrics.map((name) => ({ name })),
      limit: String(Math.min(Math.max(limit ?? 1, 1), 1000)),
    };

    if (orderBy) {
      requestBody.orderBys = [
        { metric: { metricName: orderBy.metric }, desc: !!orderBy.desc },
      ];
    }

    const cacheKey = `ga:runReport|user:${userId}|prop:${propertyResourceName}|body:${stableStringify(
      requestBody,
    )}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const dataClient = await getAnalyticsDataClient(userId);
    const { data } = await dataClient.properties.runReport({
      property: propertyResourceName,
      requestBody,
    });

    const headers = [
      ...(data.dimensionHeaders?.map((h) => h.name ?? "") ?? []),
      ...(data.metricHeaders?.map((h) => h.name ?? "") ?? []),
    ];

    const rows = (data.rows ?? []).map((row) => [
      ...(row.dimensionValues?.map((v) => v.value ?? "") ?? []),
      ...(row.metricValues?.map((v) => v.value ?? "") ?? []),
    ]);

    const normalized = {
      headers,
      rows,
      rowCount: data.rowCount ?? rows.length,
      propertyResourceName,
      dateRange,
    };

    const result = JSON.stringify(normalized);
    setCached(cacheKey, result);
    return result;
  },
  {
    name: "ga_run_report",
    description:
      "Run a GA4 report for the user's selected property (or an optional propertyId). Provide metrics (required) and optional dimensions, dateRange, limit, and orderBy. Returns JSON with headers, rows, rowCount.",
    schema: z.object({
      propertyId: z
        .string()
        .min(1)
        .optional()
        .describe(
          "GA4 numeric property ID, e.g., '123456789'. If omitted, uses the currently selected property.",
        ),
      dimensions: z
        .array(z.string().min(1))
        .max(6)
        .optional()
        .describe(
          "Optional dimension names (max 6), e.g., 'date', 'country', 'sessionDefaultChannelGroup'.",
        ),
      metrics: z
        .array(z.string().min(1))
        .min(1)
        .max(10)
        .describe(
          "Required metric names (1-10), e.g., 'sessions', 'totalRevenue', 'purchases'.",
        ),
      dateRange: dateRangeSchema
        .optional()
        .describe(
          "Date range with startDate/endDate (e.g., '28daysAgo' to 'yesterday' or '2024-01-01' to '2024-01-31'). Defaults to last 28 days.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional()
        .describe("Max rows to return (1-1000). Defaults to 50."),
      orderBy: orderBySchema
        .optional()
        .describe("Order by a single metric, optionally descending."),
    }),
  },
);
