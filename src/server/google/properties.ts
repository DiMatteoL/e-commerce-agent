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

  const { data } = await admin.accountSummaries.list();
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
