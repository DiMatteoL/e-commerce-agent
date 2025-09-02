"use client";

import * as React from "react";
import { ChevronsUpDown, GalleryVerticalEnd } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { api } from "@/trpc/react";
import { Ga4OnboardingDialog } from "@/components/ga4-onboarding-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export function TeamSwitcher() {
  const t = useTranslations("TeamSwitcher");
  const { data, isLoading: isLoadingSelected } =
    api.google_analytics.getSelectedProperty.useQuery();

  const [open, setOpen] = React.useState(false);
  const accountsQuery = api.google_analytics.listAccounts.useQuery(undefined, {
    enabled: open,
  });
  const accounts = accountsQuery.data ? [...accountsQuery.data] : [];
  const isLoadingAccounts = accountsQuery.isLoading;

  const propertyLabel =
    data?.property?.propertyDisplayName ??
    data?.property?.propertyResourceName ??
    t("pickYourProject");

  const accountLabel =
    data?.property?.accountDisplayName ?? t("onGoogleAnalytics");

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            onClick={() => setOpen(true)}
          >
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <GalleryVerticalEnd size={16} />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              {isLoadingSelected ? (
                <>
                  <Skeleton className="mb-1 h-3 w-28" />
                  <Skeleton className="h-2 w-20" />
                </>
              ) : (
                <>
                  <span className="truncate font-medium">{propertyLabel}</span>
                  <span className="truncate text-xs">{accountLabel}</span>
                </>
              )}
            </div>
            <ChevronsUpDown className="ml-auto" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <Ga4OnboardingDialog
        open={open}
        onOpenChange={setOpen}
        accounts={accounts}
        loading={isLoadingAccounts}
      />
    </>
  );
}
