"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GoogleAccountCard } from "@/components/ga4/account-card";
import { GooglePropertyCard } from "@/components/ga4/property-card";
import { api } from "@/trpc/react";
import { Skeleton } from "@/components/ui/skeleton";
import { useReconnectGoogle } from "@/hooks/use-reconnect-google";
import { RefreshCw } from "lucide-react";

type Ga4DataStream = {
  streamResourceName: string;
  streamId: string;
  streamDisplayName?: string | null;
  type?: string | null;
};

type Ga4PropertySummary = {
  propertyResourceName: string;
  propertyId: string;
  propertyDisplayName?: string | null;
  dataStreams: Ga4DataStream[];
};

type Ga4AccountSummary = {
  accountResourceName: string;
  accountDisplayName?: string | null;
  properties: Ga4PropertySummary[];
};

export type Ga4OnboardingDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  accounts: Ga4AccountSummary[];
  loading?: boolean;
  errorMessage?: string | null;
  unauthorized?: boolean;
  connectUrl?: string;
  apiNotEnabled?: boolean;
  projectId?: string;
};

export function Ga4OnboardingDialog({
  open = true,
  onOpenChange,
  accounts,
  loading = false,
  errorMessage,
  unauthorized = false,
  connectUrl = "/api/auth/signin?provider=google",
  apiNotEnabled = false,
  projectId,
}: Ga4OnboardingDialogProps) {
  const t = useTranslations("GA4OnboardingDialog");
  const router = useRouter();
  const [selectedProperty, setSelectedProperty] = React.useState<string | null>(
    null,
  );
  const [submitting, setSubmitting] = React.useState(false);

  const utils = api.useUtils();

  const selectMutation = api.google_analytics.selectProperty.useMutation();

  // Check connection status
  const { data: connectionStatus } =
    api.google_analytics.getConnectionStatus.useQuery();

  // Reconnection hook
  const { startReconnection, reconnecting } = useReconnectGoogle();

  const isPropChecked = (prop: Ga4PropertySummary) =>
    selectedProperty === prop.propertyResourceName;

  const setPropChecked = (prop: Ga4PropertySummary) => {
    setSelectedProperty((prev) =>
      prev === prop.propertyResourceName ? null : prop.propertyResourceName,
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty) return;
    setSubmitting(true);
    try {
      await selectMutation.mutateAsync({
        propertyResourceName: selectedProperty,
      });
      await utils.google_analytics.getSelectedProperty.invalidate();
      await utils.user.getUserWithChats.invalidate();
      onOpenChange?.(false);
      router.replace("/");
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const adminApiUrl = `https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com${projectId ? `?project=${projectId}` : ""}`;
  const dataApiUrl = `https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com${projectId ? `?project=${projectId}` : ""}`;

  const renderError = () => {
    // Handle OAuth connection errors
    if (connectionStatus && !connectionStatus.isHealthy) {
      return (
        <div className="border-destructive/50 bg-destructive/10 rounded-md border p-4 text-sm">
          <div className="mb-1 font-medium">
            {t("error.connectionExpired.title")}
          </div>
          <div className="text-muted-foreground mb-3">
            {connectionStatus.warningMessage ??
              t("error.connectionExpired.body")}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => startReconnection()}
              disabled={reconnecting}
            >
              {reconnecting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  {t("error.connectionExpired.reconnecting")}
                </>
              ) : (
                t("error.connectionExpired.primaryCta")
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange?.(false)}
              disabled={reconnecting}
            >
              {t("error.connectionExpired.secondaryCta")}
            </Button>
          </div>
          <div className="text-muted-foreground mt-2 text-xs">
            {t("error.connectionExpired.finePrint")}
          </div>
        </div>
      );
    }

    if (apiNotEnabled) {
      return (
        <div className="border-destructive/50 bg-destructive/10 rounded-md border p-4 text-sm">
          <div className="mb-1 font-medium">
            {t("error.apiNotEnabled.title")}
          </div>
          <div className="text-muted-foreground">
            {t("error.apiNotEnabled.body")}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a href={adminApiUrl} target="_blank" rel="noreferrer noopener">
              <Button size="sm" variant="default">
                {t("error.apiNotEnabled.primaryCtaAdmin")}
              </Button>
            </a>
            <a href={dataApiUrl} target="_blank" rel="noreferrer noopener">
              <Button size="sm" variant="secondary">
                {t("error.apiNotEnabled.primaryCtaData")}
              </Button>
            </a>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange?.(false)}
            >
              {t("error.apiNotEnabled.secondaryCta")}
            </Button>
          </div>
          <div className="text-muted-foreground mt-2 text-xs">
            {t("error.apiNotEnabled.finePrint")}
          </div>
        </div>
      );
    }

    if (!errorMessage) return null;
    if (unauthorized) {
      return (
        <div className="border-destructive/50 bg-destructive/10 rounded-md border p-4 text-sm">
          <div className="mb-1 font-medium">
            {t("error.missingPermissions.title")}
          </div>
          <div className="text-muted-foreground">
            {t("error.missingPermissions.body")}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <a href={connectUrl}>
              <Button size="sm">
                {t("error.missingPermissions.primaryCta")}
              </Button>
            </a>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange?.(false)}
            >
              {t("error.missingPermissions.secondaryCta")}
            </Button>
          </div>
          <div className="text-muted-foreground mt-2 text-xs">
            {t("error.missingPermissions.finePrint")}
          </div>
        </div>
      );
    }
    return (
      <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
        {errorMessage}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-[60vh] space-y-4 overflow-auto pr-2">
            {renderError()}
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-muted-foreground">
                No GA4 accounts found.
              </div>
            ) : (
              accounts.map((acct) => (
                <GoogleAccountCard
                  key={acct.accountResourceName}
                  accountName={acct.accountDisplayName}
                  resourceName={acct.accountResourceName}
                >
                  <div className="grid gap-2">
                    {acct.properties.map((prop) => (
                      <GooglePropertyCard
                        key={prop.propertyResourceName}
                        checked={isPropChecked(prop)}
                        onToggle={() => setPropChecked(prop)}
                        propertyName={prop.propertyDisplayName}
                        resourceName={prop.propertyResourceName}
                      />
                    ))}
                  </div>
                </GoogleAccountCard>
              ))
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedProperty || submitting}>
              {submitting ? "Saving..." : "Continue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
