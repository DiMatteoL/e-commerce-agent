import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  googleAnalyticsAccounts,
  googleAnalyticsProperties,
} from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import {
  getAnalyticsDataClient,
  getAnalyticsAdminClient,
} from "@/server/google/client";
import { type analyticsdata_v1beta } from "googleapis";

// Minimal, server-side utility to call GA4 Data API
async function runGaReport(options: {
  userId: string;
  propertyResourceName: string; // e.g. properties/123456
  dateRange?: { startDate: string; endDate: string };
  dimensions?: string[];
  metrics: string[];
  limit?: number;
  orderBys?: analyticsdata_v1beta.Schema$OrderBy[];
  dimensionFilter?: analyticsdata_v1beta.Schema$FilterExpression;
}) {
  const {
    userId,
    propertyResourceName,
    dateRange = { startDate: "28daysAgo", endDate: "yesterday" },
    dimensions = [],
    metrics,
    limit,
    orderBys,
    dimensionFilter,
  } = options;

  const dataClient = await getAnalyticsDataClient(userId);

  const request: analyticsdata_v1beta.Schema$RunReportRequest = {
    dateRanges: [dateRange],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    limit: typeof limit === "number" ? String(limit) : undefined,
    orderBys,
    dimensionFilter,
  };

  const { data } = await dataClient.properties.runReport({
    requestBody: request,
    property: propertyResourceName,
  });
  return data;
}

async function getWebsiteAddress(options: {
  userId: string;
  propertyResourceName: string;
}): Promise<string | null> {
  const { userId, propertyResourceName } = options;
  try {
    const admin = await getAnalyticsAdminClient(userId);
    const list = await admin.properties.dataStreams.list({
      parent: propertyResourceName,
    });
    const streams = list.data.dataStreams ?? [];
    const webStream = streams.find((s) => s.type === "WEB_DATA_STREAM");
    if (!webStream?.name) return null;
    const { data } = await admin.properties.dataStreams.get({
      name: webStream.name,
    });
    const uri = (data as any)?.webStreamData?.defaultUri as string | undefined;
    return uri ?? null;
  } catch {
    return null;
  }
}

function toNumber(value: string | undefined | null): number {
  if (!value) return 0;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export default async function Page() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="p-6">
        <h1 className="mb-2 text-xl font-semibold">Connect your account</h1>
        <p className="text-muted-foreground">
          Please sign in to view your Google Analytics ecommerce metrics.
        </p>
      </div>
    );
  }

  // Lookup currently selected GA4 property for this user
  const rows = await db
    .select({
      propertyResourceName: googleAnalyticsProperties.propertyResourceName,
      propertyDisplayName: googleAnalyticsProperties.propertyDisplayName,
      accountDisplayName: googleAnalyticsAccounts.accountDisplayName,
    })
    .from(googleAnalyticsProperties)
    .innerJoin(
      googleAnalyticsAccounts,
      eq(googleAnalyticsProperties.accountId, googleAnalyticsAccounts.id),
    )
    .where(
      and(
        eq(googleAnalyticsProperties.userId, userId),
        eq(googleAnalyticsProperties.selected, true),
      ),
    )
    .limit(1);

  const selected = rows[0];
  if (!selected) {
    return (
      <div className="p-6">
        <h1 className="mb-2 text-xl font-semibold">
          Pick a Google Analytics 4 property
        </h1>
        <p className="text-muted-foreground">
          Use the project switcher to select a GA4 property. Once selected, your
          ecommerce KPIs will appear here.
        </p>
      </div>
    );
  }

  const websiteAddress = await getWebsiteAddress({
    userId,
    propertyResourceName: selected.propertyResourceName,
  });

  // Fetch overview KPIs (last 28 days)
  let overviewKpis: {
    revenue: number;
    purchases: number;
    sessions: number;
    addToCarts: number;
    checkouts: number;
    conversionRate: number; // derived = purchases / sessions
  } = {
    revenue: 0,
    purchases: 0,
    sessions: 0,
    addToCarts: 0,
    checkouts: 0,
    conversionRate: 0,
  };

  try {
    const overview = await runGaReport({
      userId,
      propertyResourceName: selected.propertyResourceName,
      metrics: [
        "totalRevenue",
        "purchases",
        "sessions",
        "addToCarts",
        "checkouts",
      ],
    });
    const cells = overview.rows?.[0]?.metricValues ?? [];
    overviewKpis = {
      revenue: toNumber(cells[0]?.value),
      purchases: toNumber(cells[1]?.value),
      sessions: toNumber(cells[2]?.value),
      addToCarts: toNumber(cells[3]?.value),
      checkouts: toNumber(cells[4]?.value),
      conversionRate: (() => {
        const p = toNumber(cells[1]?.value);
        const s = toNumber(cells[2]?.value);
        return s > 0 ? (p / s) * 100 : 0;
      })(),
    };
  } catch (err) {
    // Gracefully continue; we'll show what we can on the page
  }

  // Revenue trend by date (last 14 days)
  let revenueSeries: { date: string; revenue: number }[] = [];
  try {
    const series = await runGaReport({
      userId,
      propertyResourceName: selected.propertyResourceName,
      dateRange: { startDate: "14daysAgo", endDate: "yesterday" },
      dimensions: ["date"],
      metrics: ["totalRevenue"],
      orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
    });
    revenueSeries =
      series.rows?.map((r) => ({
        date: r.dimensionValues?.[0]?.value ?? "",
        revenue: toNumber(r.metricValues?.[0]?.value),
      })) ?? [];
    // Ensure ascending by date (safety)
    revenueSeries.sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );
  } catch (_) {}

  // Top items by revenue
  let topItems: { itemName: string; itemRevenue: number; quantity: number }[] =
    [];
  try {
    const items = await runGaReport({
      userId,
      propertyResourceName: selected.propertyResourceName,
      dimensions: ["itemName"],
      metrics: ["itemRevenue", "itemPurchaseQuantity"],
      limit: 5,
      orderBys: [
        { metric: { metricName: "itemRevenue" }, desc: true },
        { dimension: { dimensionName: "itemName" }, desc: false },
      ],
    });
    topItems =
      items.rows?.map((r) => ({
        itemName: r.dimensionValues?.[0]?.value ?? "",
        itemRevenue: toNumber(r.metricValues?.[0]?.value),
        quantity: toNumber(r.metricValues?.[1]?.value),
      })) ?? [];
  } catch (_) {}

  // Top channels by revenue
  let topChannels: { channel: string; revenue: number }[] = [];
  try {
    const channels = await runGaReport({
      userId,
      propertyResourceName: selected.propertyResourceName,
      dimensions: ["sessionDefaultChannelGroup"],
      metrics: ["totalRevenue"],
      limit: 5,
      orderBys: [{ metric: { metricName: "totalRevenue" }, desc: true }],
    });
    topChannels =
      channels.rows?.map((r) => ({
        channel: r.dimensionValues?.[0]?.value ?? "",
        revenue: toNumber(r.metricValues?.[0]?.value),
      })) ?? [];
  } catch (_) {}

  // SEO: Organic traffic overview (sessions, users, revenue)
  let organicOverview: { sessions: number; users: number; revenue: number } = {
    sessions: 0,
    users: 0,
    revenue: 0,
  };
  try {
    const organic = await runGaReport({
      userId,
      propertyResourceName: selected.propertyResourceName,
      metrics: ["sessions", "totalUsers", "totalRevenue"],
      dimensionFilter: {
        filter: {
          fieldName: "sessionDefaultChannelGroup",
          stringFilter: { value: "Organic Search", matchType: "EXACT" },
        },
      },
    });
    const cells = organic.rows?.[0]?.metricValues ?? [];
    organicOverview = {
      sessions: toNumber(cells[0]?.value),
      users: toNumber(cells[1]?.value),
      revenue: toNumber(cells[2]?.value),
    };
  } catch (_) {}

  // SEO: Top pages by views (last 28 days)
  let topPages: { path: string; title: string; views: number }[] = [];
  try {
    const pages = await runGaReport({
      userId,
      propertyResourceName: selected.propertyResourceName,
      dimensions: ["pagePathPlusQueryString", "pageTitle"],
      metrics: ["screenPageViews"],
      limit: 10,
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    });
    topPages =
      pages.rows?.map((r) => ({
        path: r.dimensionValues?.[0]?.value ?? "",
        title: r.dimensionValues?.[1]?.value ?? "",
        views: toNumber(r.metricValues?.[0]?.value),
      })) ?? [];
  } catch (_) {}

  // SEO: Bounce rate by landing page
  let bounceByLanding: {
    page: string;
    sessions: number;
    bounceRate: number;
  }[] = [];
  try {
    const bounce = await runGaReport({
      userId,
      propertyResourceName: selected.propertyResourceName,
      dimensions: ["landingPage"],
      metrics: ["sessions", "bounceRate"],
      limit: 10,
      orderBys: [{ metric: { metricName: "bounceRate" }, desc: true }],
    });
    bounceByLanding =
      bounce.rows?.map((r) => ({
        page: r.dimensionValues?.[0]?.value ?? "",
        sessions: toNumber(r.metricValues?.[0]?.value),
        bounceRate: toNumber(r.metricValues?.[1]?.value),
      })) ?? [];
  } catch (_) {}

  // SEO: Engagement rate trend (last 28 days)
  let engagementSeries: { date: string; engagementRate: number }[] = [];
  try {
    const er = await runGaReport({
      userId,
      propertyResourceName: selected.propertyResourceName,
      dateRange: { startDate: "28daysAgo", endDate: "yesterday" },
      dimensions: ["date"],
      metrics: ["engagementRate"],
      orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
    });
    engagementSeries =
      er.rows?.map((r) => ({
        date: r.dimensionValues?.[0]?.value ?? "",
        engagementRate: toNumber(r.metricValues?.[0]?.value),
      })) ?? [];
  } catch (_) {}

  // SEO + Ecommerce: Top organic landing pages by revenue
  let organicLandingRevenue: {
    page: string;
    revenue: number;
    purchases: number;
  }[] = [];
  try {
    const ol = await runGaReport({
      userId,
      propertyResourceName: selected.propertyResourceName,
      dimensions: ["landingPage"],
      metrics: ["totalRevenue", "purchases"],
      limit: 10,
      orderBys: [{ metric: { metricName: "totalRevenue" }, desc: true }],
      dimensionFilter: {
        filter: {
          fieldName: "sessionDefaultChannelGroup",
          stringFilter: { value: "Organic Search", matchType: "EXACT" },
        },
      },
    });
    organicLandingRevenue =
      ol.rows?.map((r) => ({
        page: r.dimensionValues?.[0]?.value ?? "",
        revenue: toNumber(r.metricValues?.[0]?.value),
        purchases: toNumber(r.metricValues?.[1]?.value),
      })) ?? [];
  } catch (_) {}

  return (
    <div className="space-y-8 p-6">
      {/* Website address at the very top */}
      <div className="bg-muted/30 rounded-md border p-3 text-sm">
        <span className="text-muted-foreground">Website:</span>{" "}
        <span className="font-medium">{websiteAddress ?? "—"}</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">
          Ecommerce overview:{" "}
          {selected.propertyDisplayName ?? selected.propertyResourceName}
        </h1>
        <p className="text-muted-foreground">{selected.accountDisplayName}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-md border p-4">
          <div className="text-muted-foreground text-sm">
            Total revenue (28d)
          </div>
          <div className="mt-2 text-2xl font-semibold">
            ${overviewKpis.revenue.toLocaleString()}
          </div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-muted-foreground text-sm">Purchases (28d)</div>
          <div className="mt-2 text-2xl font-semibold">
            {overviewKpis.purchases.toLocaleString()}
          </div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-muted-foreground text-sm">Sessions (28d)</div>
          <div className="mt-2 text-2xl font-semibold">
            {overviewKpis.sessions.toLocaleString()}
          </div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-muted-foreground text-sm">
            Add to carts (28d)
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {overviewKpis.addToCarts.toLocaleString()}
          </div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-muted-foreground text-sm">Checkouts (28d)</div>
          <div className="mt-2 text-2xl font-semibold">
            {overviewKpis.checkouts.toLocaleString()}
          </div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-muted-foreground text-sm">
            Purchase conversion rate (28d)
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {overviewKpis.conversionRate.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Revenue by date */}
      <div className="rounded-md border p-4">
        <div className="mb-4 text-sm font-medium">
          Revenue trend (last 14 days)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Date</th>
                <th className="p-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {revenueSeries.map((r) => (
                <tr key={r.date} className="border-t">
                  <td className="p-2">{r.date}</td>
                  <td className="p-2">${r.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top items */}
      <div className="rounded-md border p-4">
        <div className="mb-4 text-sm font-medium">
          Top items by revenue (28d)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Item</th>
                <th className="p-2">Revenue</th>
                <th className="p-2">Qty</th>
              </tr>
            </thead>
            <tbody>
              {topItems.map((it) => (
                <tr key={it.itemName} className="border-t">
                  <td className="p-2">{it.itemName}</td>
                  <td className="p-2">${it.itemRevenue.toLocaleString()}</td>
                  <td className="p-2">{it.quantity.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top channels */}
      <div className="rounded-md border p-4">
        <div className="mb-4 text-sm font-medium">
          Top channels by revenue (28d)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Channel</th>
                <th className="p-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topChannels.map((c) => (
                <tr key={c.channel} className="border-t">
                  <td className="p-2">{c.channel}</td>
                  <td className="p-2">${c.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEO: Organic overview */}
      <div className="rounded-md border p-4">
        <div className="mb-4 text-sm font-medium">Organic traffic (28d)</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="text-muted-foreground text-sm">
              Organic sessions
            </div>
            <div className="mt-2 text-xl font-semibold">
              {organicOverview.sessions.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Organic users</div>
            <div className="mt-2 text-xl font-semibold">
              {organicOverview.users.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Organic revenue</div>
            <div className="mt-2 text-xl font-semibold">
              ${organicOverview.revenue.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* SEO: Top pages by views */}
      <div className="rounded-md border p-4">
        <div className="mb-4 text-sm font-medium">Top pages by views (28d)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Path</th>
                <th className="p-2">Title</th>
                <th className="p-2">Views</th>
              </tr>
            </thead>
            <tbody>
              {topPages.map((p) => (
                <tr key={`${p.path}-${p.title}`} className="border-t">
                  <td className="p-2">{p.path}</td>
                  <td className="p-2">{p.title}</td>
                  <td className="p-2">{p.views.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEO: Bounce rate by landing page */}
      <div className="rounded-md border p-4">
        <div className="mb-4 text-sm font-medium">
          Bounce rate by landing page (28d)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Landing page</th>
                <th className="p-2">Sessions</th>
                <th className="p-2">Bounce rate</th>
              </tr>
            </thead>
            <tbody>
              {bounceByLanding.map((r) => (
                <tr key={r.page} className="border-t">
                  <td className="p-2">{r.page}</td>
                  <td className="p-2">{r.sessions.toLocaleString()}</td>
                  <td className="p-2">{r.bounceRate.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEO: Engagement rate trend */}
      <div className="rounded-md border p-4">
        <div className="mb-4 text-sm font-medium">
          Engagement rate trend (28d)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Date</th>
                <th className="p-2">Engagement rate</th>
              </tr>
            </thead>
            <tbody>
              {engagementSeries.map((e) => (
                <tr key={e.date} className="border-t">
                  <td className="p-2">{e.date}</td>
                  <td className="p-2">{e.engagementRate.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEO + Ecommerce: Top organic landing pages by revenue */}
      <div className="rounded-md border p-4">
        <div className="mb-4 text-sm font-medium">
          Top organic landing pages by revenue (28d)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Landing page</th>
                <th className="p-2">Revenue</th>
                <th className="p-2">Purchases</th>
              </tr>
            </thead>
            <tbody>
              {organicLandingRevenue.map((r) => (
                <tr key={r.page} className="border-t">
                  <td className="p-2">{r.page}</td>
                  <td className="p-2">${r.revenue.toLocaleString()}</td>
                  <td className="p-2">{r.purchases.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
