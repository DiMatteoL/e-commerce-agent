import { getAnalyticsAdminClient } from "@/server/google/client";

export type Ga4DataStream = {
  streamResourceName: string;
  streamId: string;
  streamDisplayName?: string | null;
  type?: string | null;
};

export type Ga4PropertySummary = {
  propertyResourceName: string; // e.g. properties/123
  propertyId: string; // e.g. 123
  propertyDisplayName?: string | null;
  dataStreams: Ga4DataStream[];
};

export type Ga4AccountSummary = {
  accountResourceName: string; // e.g. accounts/456
  accountDisplayName?: string | null;
  properties: Ga4PropertySummary[];
};

const RESOURCE_SEPARATOR = "/" as const;

export async function listAccountsWithPropertiesAndStreams(userId: string) {
  const admin = await getAnalyticsAdminClient(userId);

  console.log(`[GA4 API] Calling accountSummaries.list() for user ${userId}`);

  // DEBUG: Try to inspect the request configuration
  const auth = (admin.context as any)?._options?.auth;
  console.log(`[GA4 API] Admin client auth status:`, {
    hasContext: !!admin.context,
    hasAuth: !!auth,
    authType: typeof auth,
    hasCredentials: !!auth?.credentials,
    hasAccessToken: !!auth?.credentials?.access_token,
  });

  // WORKAROUND: Manually get access token and verify it's being used
  if (auth && typeof auth.getAccessToken === "function") {
    try {
      const tokenResponse = await auth.getAccessToken();
      console.log(`[GA4 API] Manually retrieved access token:`, {
        hasToken: !!tokenResponse?.token,
        tokenPrefix: tokenResponse?.token?.substring(0, 20),
      });
    } catch (err) {
      console.error(`[GA4 API] Failed to get access token from auth:`, err);
    }
  }

  let data;
  try {
    const response = await admin.accountSummaries.list();
    data = response.data;
    console.log(
      `[GA4 API] ✓ Successfully retrieved ${data.accountSummaries?.length ?? 0} accounts`,
    );
  } catch (err) {
    const error = err as {
      response?: { status?: number; data?: unknown };
      message?: string;
    };
    console.error(`[GA4 API] ✗ accountSummaries.list() failed:`, {
      status: error.response?.status,
      statusText: error.response?.data,
      message: error.message,
      userId,
    });
    throw err;
  }
  const accountSummaries = data.accountSummaries ?? [];

  const results: Ga4AccountSummary[] = [];

  for (const account of accountSummaries) {
    const propertySummaries = account.propertySummaries ?? [];

    const properties: Ga4PropertySummary[] = await Promise.all(
      propertySummaries.map(async (prop) => {
        const propertyResourceName = prop.property ?? "";
        const propertyId =
          propertyResourceName.split(RESOURCE_SEPARATOR)[1] ?? "";

        // List data streams for this property
        const streamsResp = await admin.properties.dataStreams.list({
          parent: propertyResourceName,
        });
        const streams = (streamsResp.data.dataStreams ?? []).map(
          (s): Ga4DataStream => {
            const streamResourceName = s.name ?? ""; // properties/{pid}/dataStreams/{sid}
            const parts = streamResourceName.split(RESOURCE_SEPARATOR);
            const streamId = parts[parts.length - 1] ?? "";
            return {
              streamResourceName,
              streamId,
              streamDisplayName: s.displayName,
              type: s.type as string | undefined,
            };
          },
        );

        return {
          propertyResourceName,
          propertyId,
          propertyDisplayName: prop.displayName,
          dataStreams: streams,
        } satisfies Ga4PropertySummary;
      }),
    );

    results.push({
      accountResourceName: account.account ?? "",
      accountDisplayName: account.displayName,
      properties,
    });
  }

  return results;
}
