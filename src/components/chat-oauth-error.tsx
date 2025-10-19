"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReconnectGoogle } from "@/hooks/use-reconnect-google";

export type ChatOAuthErrorProps = {
  message: string;
  authorizeUrl?: string;
  onReconnect?: () => void;
};

export function ChatOAuthError({
  message,
  authorizeUrl,
  onReconnect,
}: ChatOAuthErrorProps) {
  const { startReconnection, reconnecting } = useReconnectGoogle();

  const handleReconnect = () => {
    if (onReconnect) {
      onReconnect();
    } else if (authorizeUrl) {
      window.location.href = authorizeUrl;
    } else {
      startReconnection();
    }
  };

  return (
    <div className="border-destructive/50 bg-destructive/10 my-4 rounded-lg border p-4">
      <div className="flex gap-3">
        <AlertCircle className="text-destructive h-5 w-5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <p className="text-destructive text-sm font-medium">
            Google Analytics Connection Required
          </p>
          <p className="text-muted-foreground text-sm">{message}</p>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleReconnect}
              disabled={reconnecting}
              variant="default"
            >
              {reconnecting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Reconnecting...
                </>
              ) : (
                "Reconnect Google Account"
              )}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            You'll be redirected to Google to reauthorize access. Your selected
            GA4 property and settings will be preserved.
          </p>
        </div>
      </div>
    </div>
  );
}
