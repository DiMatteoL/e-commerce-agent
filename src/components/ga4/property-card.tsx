"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";

export type PropertyCardProps = {
  checked: boolean;
  onToggle: () => void;
  propertyName?: string | null;
  resourceName: string;
  secondary?: React.ReactNode;
};

export function GooglePropertyCard({
  checked,
  onToggle,
  propertyName,
  resourceName,
  secondary,
}: PropertyCardProps) {
  return (
    <div
      className="hover:bg-accent/30 flex cursor-pointer items-start gap-3 rounded-md border p-3"
      onClick={onToggle}
      role="button"
      aria-pressed={checked}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          aria-label={`Select property ${propertyName ?? resourceName}`}
        />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="font-medium">
            {propertyName ?? "(no property name)"}
          </div>
          {secondary}
        </div>
        <div className="text-muted-foreground text-xs">{resourceName}</div>
      </div>
    </div>
  );
}
