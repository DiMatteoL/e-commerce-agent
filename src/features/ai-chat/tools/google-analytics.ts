import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { type analyticsdata_v1beta } from "googleapis";
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

// --- New: metadata preflight and aliasing to prevent invalid fields ---
const MD_TTL_MS = 5 * 60_000; // 5 minutes
const metadataCache = new Map<
  string,
  { dims: Set<string>; mets: Set<string>; expiresAt: number }
>();

function parsePropertyIdFromResource(resourceName: string): string {
  // resourceName is like "properties/123456"
  const parts = resourceName.split("/");
  return parts[1] ?? resourceName;
}

function applyAlias(name: string): string {
  const map: Record<string, string> = {
    // common aliases → GA4 canonical names
    productName: "itemName",
    productId: "itemId",
    productsViewed: "itemsViewed",
    itemViews: "itemsViewed",
    revenue: "totalRevenue",
    orders: "purchases",
    transactions: "purchases",
    transaction: "purchases",
  };
  return map[name] ?? name;
}

async function getPropertyMetadataSets(
  dataClient: analyticsdata_v1beta.Analyticsdata,
  propertyResourceName: string,
): Promise<{ dims: Set<string>; mets: Set<string> }> {
  const pid = parsePropertyIdFromResource(propertyResourceName);
  const now = Date.now();
  const cached = metadataCache.get(pid);
  if (cached && cached.expiresAt > now)
    return { dims: cached.dims, mets: cached.mets };

  // Using properties.getMetadata to fetch available fields
  const { data } = await (dataClient as any).properties.getMetadata({
    name: `properties/${pid}/metadata`,
  });
  const dims = new Set<string>(
    (data.dimensions ?? []).map((d: any) => d.apiName).filter(Boolean),
  );
  const mets = new Set<string>(
    (data.metrics ?? []).map((m: any) => m.apiName).filter(Boolean),
  );
  metadataCache.set(pid, { dims, mets, expiresAt: now + MD_TTL_MS });
  return { dims, mets };
}

function sanitizeFields(
  requested: string[] | undefined,
  available: Set<string>,
  aliasFirstChoices: string[] = [],
): { kept: string[]; warnings: string[] } {
  const kept: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const raw of requested ?? []) {
    const candidate = applyAlias(raw);
    if (available.has(candidate) && !seen.has(candidate)) {
      kept.push(candidate);
      seen.add(candidate);
    } else {
      warnings.push(`Dropped unknown field: ${raw}`);
    }
  }
  // If none kept and we have suggested fallbacks, use first valid
  for (const alt of aliasFirstChoices) {
    if (kept.length > 0) break;
    const cand = applyAlias(alt);
    if (available.has(cand)) kept.push(cand);
  }
  return { kept, warnings };
}

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

    const dataClient = await getAnalyticsDataClient(userId);

    // Preflight metadata
    const { dims: availableDims, mets: availableMets } =
      await getPropertyMetadataSets(dataClient, propertyResourceName);

    const dimSan = sanitizeFields(dimensions, availableDims, ["itemName"]);
    const metSan = sanitizeFields(metrics, availableMets, [
      "purchases",
      "itemRevenue",
      "totalRevenue",
      "activeUsers",
    ]);

    const warnings: string[] = [...dimSan.warnings, ...metSan.warnings];

    if (metSan.kept.length === 0) {
      throw new Error(
        `NO_VALID_METRICS. Available examples include: purchases, totalRevenue, itemRevenue, activeUsers. Requested: ${metrics.join(", ")}`,
      );
    }

    // Ensure orderBy refers to a kept metric
    let effectiveOrderBy = orderBy;
    if (orderBy && !metSan.kept.includes(applyAlias(orderBy.metric))) {
      warnings.push(`Removed orderBy on unknown metric: ${orderBy.metric}`);
      effectiveOrderBy = undefined;
    }

    // Build request
    const requestBody: analyticsdata_v1beta.Schema$RunReportRequest = {
      dateRanges: [dateRange],
      dimensions: (dimSan.kept ?? []).map((name) => ({ name })),
      metrics: metSan.kept.map((name) => ({ name })),
      limit: String(Math.min(Math.max(limit ?? 1, 1), 1000)),
    };

    if (effectiveOrderBy) {
      requestBody.orderBys = [
        {
          metric: { metricName: applyAlias(effectiveOrderBy.metric) },
          desc: !!effectiveOrderBy.desc,
        },
      ];
    }

    const cacheKey = `ga:runReport|user:${userId}|prop:${propertyResourceName}|body:${stableStringify(
      requestBody,
    )}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    // Execute with safe fallback on common errors
    let data;
    try {
      ({ data } = await dataClient.properties.runReport({
        property: propertyResourceName,
        requestBody,
      }));
    } catch (err) {
      // Fallback: drop dimensions and try a single safe ecommerce metric
      const fallbackMetric = metSan.kept.includes("purchases")
        ? "purchases"
        : metSan.kept[0];
      warnings.push(
        `FALLBACK_APPLIED due to API error. Retrying with dimensions=[] and metric=${fallbackMetric}.`,
      );
      ({ data } = await dataClient.properties.runReport({
        property: propertyResourceName,
        requestBody: {
          dateRanges: [dateRange],
          dimensions: [],
          metrics: [{ name: fallbackMetric }],
          limit: requestBody.limit,
        },
      }));
    }

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
      warnings: warnings.length > 0 ? warnings : undefined,
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
