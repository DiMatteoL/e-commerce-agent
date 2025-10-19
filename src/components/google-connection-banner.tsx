"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGoogleConnectionStatus } from "@/hooks/use-google-connection-status";
import { useReconnectGoogle } from "@/hooks/use-reconnect-google";
import { cn } from "@/lib/utils";

export function GoogleConnectionBanner() {
  const t = useTranslations("GoogleConnection");
  const { status, isHealthy, needsReconnection, warningMessage, isLoading } =
    useGoogleConnectionStatus();

  const { startReconnection, reconnecting } = useReconnectGoogle();
  const [dismissed, setDismissed] = React.useState(false);

  // Don't show banner if loading or if user dismissed it
  if (isLoading || dismissed) return null;

  // Don't show for fully connected status
  if (status === "connected" && isHealthy) return null;

  const getVariant = () => {
    if (needsReconnection) return "destructive";
    return "info";
  };

  const getIcon = () => {
    if (needsReconnection)
      return <AlertCircle className="h-5 w-5 flex-shrink-0" />;
    return <CheckCircle className="h-5 w-5 flex-shrink-0" />;
  };

  const variant = getVariant();

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b px-4 py-3 text-sm",
        variant === "destructive" &&
          "border-destructive/50 bg-destructive/10 text-destructive",
        variant === "info" &&
          "border-blue-500/50 bg-blue-500/10 text-blue-900 dark:text-blue-100",
      )}
    >
      <div className="flex-shrink-0">{getIcon()}</div>

      <div className="min-w-0 flex-1">
        <p className="font-medium">{t(`status.${status}.title`)}</p>
        {warningMessage && (
          <p className="mt-0.5 text-xs opacity-80">{warningMessage}</p>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {needsReconnection && (
          <Button
            size="sm"
            variant="default"
            onClick={() => startReconnection()}
            disabled={reconnecting}
          >
            {reconnecting ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                {t("action.reconnecting")}
              </>
            ) : (
              t("action.reconnect")
            )}
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDismissed(true)}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t("action.dismiss")}</span>
        </Button>
      </div>
    </div>
  );
}
