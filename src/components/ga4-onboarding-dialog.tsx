"use client";

import * as React from "react";

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
};

const TITLE = "Connect Google Analytics 4 properties" as const;
const DESCRIPTION =
  "Choose a GA4 property (and app) to onboard. You can adjust later in settings." as const;

export function Ga4OnboardingDialog({
  open = true,
  onOpenChange,
  accounts,
}: Ga4OnboardingDialogProps) {
  const [selectedProperty, setSelectedProperty] = React.useState<string | null>(
    null,
  );
  const [submitting, setSubmitting] = React.useState(false);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const selectMutation = api.google_analytics.selectProperty.useMutation();

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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const res = await selectMutation.mutateAsync({
        propertyResourceName: selectedProperty,
      });
      console.log({ picked: [selectedProperty], apiResult: res });
      onOpenChange?.(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{TITLE}</DialogTitle>
            <DialogDescription>{DESCRIPTION}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-[60vh] space-y-4 overflow-auto pr-2">
            {accounts.length === 0 ? (
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
