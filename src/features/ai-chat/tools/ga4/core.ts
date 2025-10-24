import { z } from "zod";
import { type analyticsdata_v1beta } from "googleapis";
import { and, eq } from "drizzle-orm";

import { getAnalyticsDataClient } from "@/server/google/client";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { googleAnalyticsProperties } from "@/server/db/schema";

// KISS stable stringify
export function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const sorted: Record<string, unknown> = {};
  const typedObj = obj as Record<string, unknown>;
  for (const k of keys) sorted[k] = typedObj[k];
  return JSON.stringify(sorted);
}

// Tiny in-module TTL cache
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: string; expiresAt: number }>();
export function getCached(key: string): string | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}
export function setCached(
  key: string,
  value: string,
  ttlMs: number = CACHE_TTL_MS,
) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// Resolve the property resource name for this user, verifying ownership
export async function resolvePropertyResourceName(
  userId: string,
): Promise<string> {
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

export const orderBySchema = z.object({
  metric: z.string().min(1),
  desc: z.boolean().optional(),
});

export const dateRangeSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

// --- Metadata preflight and aliasing ---
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

export function applyAlias(name: string): string {
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

type GaMetadata = {
  dimensions?: Array<{ apiName?: string | null | undefined }>;
  metrics?: Array<{ apiName?: string | null | undefined }>;
};

async function getPropertyMetadataSets(
  dataClient: analyticsdata_v1beta.Analyticsdata,
  propertyResourceName: string,
): Promise<{ dims: Set<string>; mets: Set<string> }> {
  const pid = parsePropertyIdFromResource(propertyResourceName);
  const now = Date.now();
  const cached = metadataCache.get(pid);
  if (cached && cached.expiresAt > now)
    return { dims: cached.dims, mets: cached.mets };

  const resp = await (
    dataClient.properties as unknown as {
      getMetadata: (params: { name: string }) => Promise<{ data: GaMetadata }>;
    }
  ).getMetadata({ name: `properties/${pid}/metadata` });
  const data: GaMetadata = resp.data ?? {};

  const dims = new Set<string>(
    (data.dimensions ?? [])
      .map((d) => d.apiName ?? undefined)
      .filter((n): n is string => typeof n === "string" && n.length > 0),
  );
  const mets = new Set<string>(
    (data.metrics ?? [])
      .map((m) => m.apiName ?? undefined)
      .filter((n): n is string => typeof n === "string" && n.length > 0),
  );
  metadataCache.set(pid, { dims, mets, expiresAt: now + MD_TTL_MS });
  return { dims, mets };
}

export function sanitizeFields(
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

// --- Scope helpers and presets ---
export const ITEM_SCOPED_METRICS = new Set<string>([
  "itemRevenue",
  "itemsViewed",
  "itemPurchaseQuantity",
  "itemsPurchased",
  "itemsAddedToCart",
  "itemsCheckedOut",
  "itemsClickedInList",
  "itemsClickedInPromotion",
  "itemListClickEvents",
  "itemListViewEvents",
  "itemPromotionClickEvents",
  "itemPromotionViewEvents",
  "itemRefundAmount",
]);

export const USER_SCOPED_METRICS = new Set<string>([
  "activeUsers",
  "totalUsers",
  "newUsers",
  "returningUsers",
  "userEngagementDuration",
]);

export const SESSION_SCOPED_METRICS = new Set<string>([
  "sessions",
  "engagedSessions",
  "bounceRate",
  "sessionConversionRate",
  "averageSessionDuration",
  "sessionsPerUser",
]);

export const ITEM_SCOPED_DIMENSIONS = new Set<string>([
  "itemName",
  "itemId",
  "itemBrand",
  "itemVariant",
  "itemCategory",
  "itemCategory2",
  "itemCategory3",
  "itemCategory4",
  "itemCategory5",
]);

export function pickFirstAvailableItemDimension(
  availableDims: Set<string>,
): string | undefined {
  const preferred = ["itemName", "itemId", "itemBrand", "itemCategory"];
  return preferred.find((p) => availableDims.has(p));
}

// Shared core used by all GA tools
export type RunGaReportArgs = {
  dimensions?: string[];
  metrics: string[];
  dateRange?: { startDate: string; endDate: string };
  limit?: number;
  orderBy?: { metric: string; desc?: boolean };
};

export async function runGaReportCore({
  dimensions = [],
  metrics,
  dateRange = { startDate: "28daysAgo", endDate: "yesterday" },
  limit = 50,
  orderBy,
}: RunGaReportArgs): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("UNAUTHENTICATED");

  const propertyResourceName = await resolvePropertyResourceName(userId);

  const dataClient = await getAnalyticsDataClient(userId);

  // Preflight metadata
  const { dims: availableDims, mets: availableMets } =
    await getPropertyMetadataSets(dataClient, propertyResourceName);

  // Don't default to itemName - let it be empty for user/session metrics
  const dimSan = sanitizeFields(dimensions, availableDims);
  const metSan = sanitizeFields(metrics, availableMets, [
    "activeUsers",
    "totalUsers",
    "sessions",
    "purchases",
    "totalRevenue",
  ]);

  const warnings: string[] = [...dimSan.warnings, ...metSan.warnings];

  if (metSan.kept.length === 0) {
    throw new Error(
      `NO_VALID_METRICS. Available examples include: purchases, totalRevenue, itemRevenue, activeUsers. Requested: ${metrics.join(", ")}`,
    );
  }

  // Scope-aware adjustments
  let keptDimensions = dimSan.kept;
  let keptMetrics = metSan.kept;

  // Check for incompatible combinations
  const hasUserMetric = keptMetrics.some(
    (m) => USER_SCOPED_METRICS.has(m) || SESSION_SCOPED_METRICS.has(m),
  );
  const hasItemMetric = keptMetrics.some((m) => ITEM_SCOPED_METRICS.has(m));
  const hasItemDim = keptDimensions.some((d) => ITEM_SCOPED_DIMENSIONS.has(d));

  // CRITICAL: User/Session metrics are INCOMPATIBLE with item dimensions
  if (hasUserMetric && hasItemDim && !hasItemMetric) {
    // Remove item dimensions when querying user/session metrics
    const removedDims = keptDimensions.filter((d) =>
      ITEM_SCOPED_DIMENSIONS.has(d),
    );
    keptDimensions = keptDimensions.filter(
      (d) => !ITEM_SCOPED_DIMENSIONS.has(d),
    );
    warnings.push(
      `Removed incompatible item dimensions (${removedDims.join(", ")}) from user/session-scoped metrics query. User metrics like 'activeUsers' cannot be broken down by products.`,
    );
  }

  // If any metric is item-scoped but there are no item-scoped dimensions, try to inject one
  if (hasItemMetric && !hasItemDim) {
    const inject = pickFirstAvailableItemDimension(availableDims);
    if (inject) {
      keptDimensions = [inject, ...keptDimensions];
      warnings.push(
        `Added '${inject}' dimension to align with item-scoped metrics.`,
      );
    } else {
      // If we cannot add an item dimension and there is a broader revenue metric available, swap
      if (
        keptMetrics.includes("itemRevenue") &&
        availableMets.has("totalRevenue")
      ) {
        keptMetrics = keptMetrics.map((m) =>
          m === "itemRevenue" ? "totalRevenue" : m,
        );
        warnings.push(
          "Replaced 'itemRevenue' with 'totalRevenue' due to missing item-scoped dimensions.",
        );
      }
    }
  }

  // Cap dimensions to a small safe number to avoid common GA4 limits
  const DIM_CAP = 3;
  if (keptDimensions.length > DIM_CAP) {
    warnings.push(
      `Truncated dimensions to first ${DIM_CAP}: ${keptDimensions
        .slice(0, DIM_CAP)
        .join(", ")}`,
    );
    keptDimensions = keptDimensions.slice(0, DIM_CAP);
  }

  // Ensure orderBy refers to a kept metric
  let effectiveOrderBy = orderBy;
  if (orderBy && !keptMetrics.includes(applyAlias(orderBy.metric))) {
    warnings.push(`Removed orderBy on unknown metric: ${orderBy.metric}`);
    effectiveOrderBy = undefined;
  }

  // Build request
  const requestBody: analyticsdata_v1beta.Schema$RunReportRequest = {
    dateRanges: [dateRange],
    dimensions: (keptDimensions ?? []).map((name) => ({ name })),
    metrics: keptMetrics.map((name) => ({ name })),
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

  // Execute with two-step fallback on common errors
  let data: analyticsdata_v1beta.Schema$RunReportResponse;
  try {
    ({ data } = await dataClient.properties.runReport({
      property: propertyResourceName,
      requestBody,
    }));
  } catch {
    // Step 1: keep the same metrics, drop dimensions
    warnings.push(
      "FALLBACK_APPLIED due to API error. Retrying with dimensions=[] and same metrics.",
    );
    try {
      ({ data } = await dataClient.properties.runReport({
        property: propertyResourceName,
        requestBody: {
          dateRanges: [dateRange],
          dimensions: [],
          metrics: keptMetrics.map((name) => ({ name })),
          limit: requestBody.limit,
        },
      }));
    } catch {
      // Step 2: single safest metric
      const fallbackMetric = keptMetrics.includes("purchases")
        ? "purchases"
        : keptMetrics[0];
      warnings.push(
        `FALLBACK_APPLIED again. Retrying with dimensions=[] and metric=${fallbackMetric}.`,
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
}
