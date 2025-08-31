"use client";

import * as React from "react";

export type AccountCardProps = {
  accountName?: string | null;
  resourceName: string;
  children?: React.ReactNode;
};

export function GoogleAccountCard({
  accountName,
  resourceName,
  children,
}: AccountCardProps) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-3 p-4">
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="font-medium">
              {accountName ?? "(no account name)"}
            </div>
          </div>
          <div className="text-muted-foreground text-xs">{resourceName}</div>
        </div>
      </div>

      {children && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
