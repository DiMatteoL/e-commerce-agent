"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  useGoogleConnectionStatus,
  useTestGoogleConnection,
  useDisconnectGoogle,
} from "@/hooks/use-google-connection-status";
import { useReconnectGoogle } from "@/hooks/use-reconnect-google";
import { CheckCircle, XCircle, RefreshCw, Trash2 } from "lucide-react";

export function GoogleConnectionSettings() {
  const t = useTranslations("Settings.GoogleConnection");
  const {
    status,
    isHealthy,
    needsReconnection,
    warningMessage,
    expiresAt,
    scopes,
  } = useGoogleConnectionStatus();

  const { testConnection, testing, result } = useTestGoogleConnection();
  const { startReconnection, reconnecting } = useReconnectGoogle();
  const { disconnect, disconnecting } = useDisconnectGoogle();

  const handleDisconnect = async () => {
    if (!confirm(t("disconnect.confirm"))) return;

    try {
      await disconnect();
      // Refresh page to update UI
      window.location.reload();
    } catch (error) {
      console.error("Disconnect failed:", error);
    }
  };

  const formatExpiry = (timestamp?: number) => {
    if (!timestamp) return "Unknown";
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Badge variant={isHealthy ? "default" : "destructive"}>
            {status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            {isHealthy ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="text-destructive h-4 w-4" />
            )}
            <span className="font-medium">
              {isHealthy ? t("status.healthy") : t("status.unhealthy")}
            </span>
          </div>

          {warningMessage && (
            <p className="text-muted-foreground text-sm">{warningMessage}</p>
          )}
        </div>

        <Separator />

        {/* Details Section */}
        {status !== "not_connected" && (
          <>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expires:</span>
                <span className="font-mono">{formatExpiry(expiresAt)}</span>
              </div>

              {scopes && scopes.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Scopes:</span>
                  <ul className="mt-1 space-y-1">
                    {scopes.map((scope) => (
                      <li key={scope} className="font-mono text-xs opacity-70">
                        • {scope}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Separator />
          </>
        )}

        {/* Actions Section */}
        <div className="flex flex-wrap gap-2">
          {status === "not_connected" ? (
            <Button onClick={() => startReconnection()} disabled={reconnecting}>
              {reconnecting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect Google Account"
              )}
            </Button>
          ) : (
            <>
              {needsReconnection && (
                <Button
                  onClick={() => startReconnection()}
                  disabled={reconnecting}
                >
                  {reconnecting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Reconnecting...
                    </>
                  ) : (
                    "Reconnect Account"
                  )}
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => testConnection()}
                disabled={testing}
              >
                {testing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>

              <Button
                variant="destructive"
                size="icon"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Test Result */}
        {result && (
          <div
            className={`rounded-md p-3 text-sm ${
              result.success
                ? "bg-green-500/10 text-green-900 dark:text-green-100"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {result.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
