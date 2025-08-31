import { auth } from "@/server/auth";
import {
  getAnalyticsDataClient,
  getAnalyticsAdminClient,
  GoogleOAuthRequired,
} from "@/server/google/client";
import { listAccountsWithPropertiesAndStreams } from "@/server/google/properties";
import { persistGaAccountsAndPropertiesIfMissing } from "@/server/google/persist";
import { Ga4OnboardingDialog } from "@/components/ga4-onboarding-dialog";

const QUERY_PARAM_PROPERTY_ID = "propertyId" as const;
const GA4_PROPERTY_PREFIX = "properties/" as const;
const DEFAULT_DATE_RANGE_START = "60daysAgo" as const;
const DEFAULT_DATE_RANGE_END = "today" as const;
const DEFAULT_METRIC_ACTIVE_USERS = "activeUsers" as const;

const HEADING_ACTIVE_USERS = "Active users (last 60 days)" as const;
const HEADING_AVAILABLE_PROPERTIES = "Available GA4 properties" as const;

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function Abc(props: PageProps) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return <div>Signed out</div>;
  }

  const rawPropertyId = props.searchParams?.[QUERY_PARAM_PROPERTY_ID];
  const propertyId = Array.isArray(rawPropertyId)
    ? rawPropertyId[0]
    : rawPropertyId;

  // Build property path from query if provided; accept both numeric ID and full path
  const propertyPathFromQuery = propertyId
    ? propertyId.startsWith(GA4_PROPERTY_PREFIX)
      ? propertyId
      : `${GA4_PROPERTY_PREFIX}${propertyId}`
    : undefined;

  try {
    const dataClient = await getAnalyticsDataClient(userId);

    let propertyPath = propertyPathFromQuery;

    // Fallback: discover first GA4 property via Admin API
    const admin = await getAnalyticsAdminClient(userId);
    const summaries = await admin.accountSummaries.list();

    if (!propertyPath) {
      propertyPath = summaries.data.accountSummaries
        ?.flatMap((s) => s.propertySummaries ?? [])
        .map((p) => p.property)
        .find((p): p is string => Boolean(p));
    }

    const { data } = propertyPath
      ? await dataClient.properties.runReport({
          property: propertyPath,
          requestBody: {
            dateRanges: [
              {
                startDate: DEFAULT_DATE_RANGE_START,
                endDate: DEFAULT_DATE_RANGE_END,
              },
            ],
            metrics: [{ name: DEFAULT_METRIC_ACTIVE_USERS }],
          },
        })
      : { data: undefined };

    const activeUsersStr = data?.rows?.[0]?.metricValues?.[0]?.value ?? "0";
    const activeUsers = Number.parseInt(activeUsersStr, 10);

    // Fetch and persist GA resources for this user (idempotent)
    const accounts = await listAccountsWithPropertiesAndStreams(userId);
    await persistGaAccountsAndPropertiesIfMissing(userId, accounts);

    return (
      <div>
        <h1>{HEADING_ACTIVE_USERS}</h1>
        <p>Property: {propertyPath ?? "(auto-pick pending)"}</p>
        <p style={{ fontSize: 24, fontWeight: 600 }}>
          {Number.isFinite(activeUsers) ? activeUsers : 0}
        </p>

        <hr style={{ margin: "24px 0" }} />

        <h2>{HEADING_AVAILABLE_PROPERTIES}</h2>
        <Ga4OnboardingDialog accounts={accounts} />
      </div>
    );
  } catch (err) {
    if (err instanceof GoogleOAuthRequired) {
      const e = err.toJSON();
      return (
        <div>
          <p>{e.message}</p>
          <a href={e.authorizeUrl}>Connect Google</a>
        </div>
      );
    }

    return (
      <div>
        <p>Failed to load GA4 data.</p>
        <pre>{String(err)}</pre>
      </div>
    );
  }
}
