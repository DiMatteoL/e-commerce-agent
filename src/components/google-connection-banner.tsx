"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Sparkles, ArrowRight } from "lucide-react";
import { useGoogleConnectionStatus } from "@/hooks/use-google-connection-status";
import { useReconnectGoogle } from "@/hooks/use-reconnect-google";
import { cn } from "@/lib/utils";

export function GoogleConnectionBanner() {
  const t = useTranslations("GoogleConnection");
  const { status, isHealthy, needsReconnection, warningMessage, isLoading } =
    useGoogleConnectionStatus();

  const { startReconnection, reconnecting } = useReconnectGoogle();

  // Don't show banner if loading
  if (isLoading) return null;

  // Don't show for fully connected status
  if (status === "connected" && isHealthy) return null;

  const isNotConnected = status === "not_connected";

  const getVariant = () => {
    if (needsReconnection) return "destructive";
    return "info";
  };

  const getIcon = () => {
    return <Sparkles className="h-4 w-4 flex-shrink-0" />;
  };

  const variant = getVariant();

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 px-4 py-2 text-sm",
        variant === "destructive" && "bg-secondary text-secondary-foreground",
        variant === "info" && "bg-secondary text-secondary-foreground",
      )}
    >
      <div className="flex-shrink-0">{getIcon()}</div>

      <div className="min-w-0">
        <p className="font-medium">{t(`status.${status}.title`)}</p>
        {warningMessage && (
          <p className="mt-0.5 text-xs opacity-80">{warningMessage}</p>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-3">
        {isNotConnected ? (
          <button
            onClick={() => startReconnection()}
            disabled={reconnecting}
            className="flex cursor-pointer items-center gap-1 text-sm font-medium underline underline-offset-4 hover:no-underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reconnecting ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                {t("action.connecting")}
              </>
            ) : (
              <>
                {t("action.connect")}
                <ArrowRight className="h-3 w-3" />
              </>
            )}
          </button>
        ) : needsReconnection ? (
          <button
            onClick={() => startReconnection()}
            disabled={reconnecting}
            className="flex cursor-pointer items-center gap-1 text-sm font-medium underline underline-offset-4 hover:no-underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reconnecting ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                {t("action.reconnecting")}
              </>
            ) : (
              <>
                {t("action.reconnect")}
                <ArrowRight className="h-3 w-3" />
              </>
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
