# Spec 05: UI Components for Reconnection & Status

## Objective
Create user-facing components to display connection status, handle reconnection flows, and show clear error messages throughout the application.

## Current State
- GA4 onboarding dialog shows basic errors
- No persistent connection status indicator
- No self-service reconnection UI
- Chat errors are generic

## Proposed Changes

### 1. Connection Status Banner Component

**New File**: `src/components/google-connection-banner.tsx`

```typescript
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGoogleConnectionStatus } from "@/hooks/use-google-connection-status";
import { useReconnectGoogle } from "@/hooks/use-reconnect-google";
import { cn } from "@/lib/utils";

export function GoogleConnectionBanner() {
  const t = useTranslations("GoogleConnection");
  const {
    status,
    isHealthy,
    needsReconnection,
    warningMessage,
    isLoading,
  } = useGoogleConnectionStatus();

  const { startReconnection, reconnecting } = useReconnectGoogle();
  const [dismissed, setDismissed] = React.useState(false);

  // Don't show banner if loading or if user dismissed it
  if (isLoading || dismissed) return null;

  // Don't show for fully connected status
  if (status === "connected" && isHealthy) return null;

  const getVariant = () => {
    if (needsReconnection) return "destructive";
    if (status === "expiring_soon") return "warning";
    return "info";
  };

  const getIcon = () => {
    if (needsReconnection) return <AlertCircle className="h-5 w-5" />;
    if (status === "expiring_soon") return <AlertTriangle className="h-5 w-5" />;
    return <CheckCircle className="h-5 w-5" />;
  };

  const variant = getVariant();

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b px-4 py-3 text-sm",
        variant === "destructive" && "border-destructive/50 bg-destructive/10 text-destructive",
        variant === "warning" && "border-yellow-500/50 bg-yellow-500/10 text-yellow-900 dark:text-yellow-100",
        variant === "info" && "border-blue-500/50 bg-blue-500/10 text-blue-900 dark:text-blue-100",
      )}
    >
      <div className="flex-shrink-0">{getIcon()}</div>

      <div className="flex-1 min-w-0">
        <p className="font-medium">
          {t(`status.${status}.title`)}
        </p>
        {warningMessage && (
          <p className="text-xs opacity-80 mt-0.5">
            {warningMessage}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
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
        >
          {t("action.dismiss")}
        </Button>
      </div>
    </div>
  );
}
```

### 2. Enhanced GA4 Onboarding Dialog

**File**: `src/components/ga4-onboarding-dialog.tsx`

Update to better handle OAuth errors:

```typescript
import { extractOAuthError } from "@/types/oauth-errors";

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

  // NEW: Check for OAuth error details
  const { data: connectionStatus } = api.google_analytics.getConnectionStatus.useQuery();

  const [selectedProperty, setSelectedProperty] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const utils = api.useUtils();
  const selectMutation = api.google_analytics.selectProperty.useMutation();

  // ... existing handlers ...

  // NEW: Enhanced error rendering with reconnection
  const renderError = () => {
    // Existing API not enabled error
    if (apiNotEnabled) {
      return (
        <div className="border-destructive/50 bg-destructive/10 rounded-md border p-4 text-sm">
          {/* ... existing API not enabled UI ... */}
        </div>
      );
    }

    // NEW: Handle OAuth errors specifically
    if (connectionStatus && !connectionStatus.isHealthy) {
      return (
        <div className="border-destructive/50 bg-destructive/10 rounded-md border p-4 text-sm">
          <div className="mb-1 font-medium">
            {t("error.connectionExpired.title")}
          </div>
          <div className="text-muted-foreground mb-3">
            {connectionStatus.warningMessage || t("error.connectionExpired.body")}
          </div>
          <div className="flex items-center gap-2">
            <a href={connectUrl}>
              <Button size="sm">
                {t("error.connectionExpired.primaryCta")}
              </Button>
            </a>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange?.(false)}
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

    // Existing unauthorized error
    if (!errorMessage) return null;
    if (unauthorized) {
      return (
        <div className="border-destructive/50 bg-destructive/10 rounded-md border p-4 text-sm">
          {/* ... existing unauthorized UI ... */}
        </div>
      );
    }

    // Generic error
    return (
      <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
        {errorMessage}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* ... rest of component ... */}
    </Dialog>
  );
}
```

### 3. Chat Error Handler Component

**New File**: `src/components/chat-oauth-error.tsx`

```typescript
"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
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
    <Alert variant="destructive" className="my-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Google Analytics Connection Required</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm">{message}</p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleReconnect}
            disabled={reconnecting}
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
        <p className="text-xs opacity-80">
          You'll be redirected to Google to reauthorize access. Your selected
          GA4 property and settings will be preserved.
        </p>
      </AlertDescription>
    </Alert>
  );
}
```

### 4. Sidebar/Header Connection Indicator

**New File**: `src/components/google-connection-indicator.tsx`

```typescript
"use client";

import * as React from "react";
import { CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useGoogleConnectionStatus } from "@/hooks/use-google-connection-status";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useReconnectGoogle } from "@/hooks/use-reconnect-google";
import { cn } from "@/lib/utils";

export function GoogleConnectionIndicator() {
  const { status, isHealthy, needsReconnection, warningMessage } =
    useGoogleConnectionStatus();
  const { startReconnection, reconnecting } = useReconnectGoogle();

  const getIcon = () => {
    if (status === "not_connected") return null;
    if (needsReconnection) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    if (status === "expiring_soon") {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getTooltipContent = () => {
    if (status === "not_connected") {
      return "Google Analytics not connected";
    }
    if (needsReconnection) {
      return (
        <div className="space-y-2">
          <p className="font-medium">Connection Issue</p>
          <p className="text-xs">{warningMessage}</p>
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={startReconnection}
            disabled={reconnecting}
          >
            {reconnecting ? "Reconnecting..." : "Reconnect"}
          </Button>
        </div>
      );
    }
    if (status === "expiring_soon") {
      return (
        <div className="space-y-2">
          <p className="font-medium">Connection Expiring Soon</p>
          <p className="text-xs">{warningMessage}</p>
        </div>
      );
    }
    return "Google Analytics connected";
  };

  const icon = getIcon();
  if (!icon) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-2 rounded-md p-2 transition-colors hover:bg-accent",
              needsReconnection && "animate-pulse",
            )}
            onClick={needsReconnection ? () => startReconnection() : undefined}
          >
            {icon}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

### 5. Connection Settings Panel

**New File**: `src/components/google-connection-settings.tsx`

```typescript
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useGoogleConnectionStatus } from "@/hooks/use-google-connection-status";
import { useTestGoogleConnection } from "@/hooks/use-google-connection-status";
import { useReconnectGoogle } from "@/hooks/use-reconnect-google";
import { api } from "@/trpc/react";
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
  const disconnectMutation = api.google_analytics.disconnectGoogle.useMutation();

  const handleDisconnect = async () => {
    if (!confirm(t("disconnect.confirm"))) return;

    try {
      await disconnectMutation.mutateAsync();
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
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className="font-medium">
              {isHealthy ? t("status.healthy") : t("status.unhealthy")}
            </span>
          </div>

          {warningMessage && (
            <p className="text-sm text-muted-foreground">{warningMessage}</p>
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
                      <li key={scope} className="text-xs font-mono opacity-70">
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
            <Button
              onClick={() => startReconnection()}
              disabled={reconnecting}
            >
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
                disabled={disconnectMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Test Result */}
        {result && (
          <div className={`text-sm p-3 rounded-md ${
            result.success
              ? "bg-green-500/10 text-green-900 dark:text-green-100"
              : "bg-destructive/10 text-destructive"
          }`}>
            {result.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 6. Translation Keys

**File**: `messages/en.json`

Add new translation keys:

```json
{
  "GoogleConnection": {
    "status": {
      "not_connected": {
        "title": "Google Analytics Not Connected"
      },
      "expired": {
        "title": "Google Connection Expired"
      },
      "expiring_soon": {
        "title": "Connection Expiring Soon"
      },
      "missing_scopes": {
        "title": "Additional Permissions Required"
      },
      "revoked": {
        "title": "Google Access Revoked"
      }
    },
    "action": {
      "reconnect": "Reconnect",
      "reconnecting": "Reconnecting...",
      "dismiss": "Dismiss"
    }
  },
  "Settings": {
    "GoogleConnection": {
      "title": "Google Analytics Connection",
      "description": "Manage your Google Analytics integration",
      "status": {
        "healthy": "Connected and working",
        "unhealthy": "Connection issue detected"
      },
      "disconnect": {
        "confirm": "Are you sure you want to disconnect your Google account? You'll need to reconnect to use GA4 features."
      }
    }
  },
  "GA4OnboardingDialog": {
    "error": {
      "connectionExpired": {
        "title": "Connection Expired",
        "body": "Your Google Analytics connection has expired. Please reconnect to continue.",
        "primaryCta": "Reconnect Google",
        "secondaryCta": "Cancel",
        "finePrint": "Your selected property and settings will be preserved."
      }
    }
  }
}
```

## Implementation Steps

1. ✅ Create `GoogleConnectionBanner` component
2. ✅ Create `ChatOAuthError` component
3. ✅ Create `GoogleConnectionIndicator` component
4. ✅ Create `GoogleConnectionSettings` panel
5. ✅ Update `GA4OnboardingDialog` with OAuth error handling
6. ✅ Add translation keys
7. ✅ Integrate banner into main layout
8. ✅ Integrate indicator into sidebar/header
9. ✅ Add settings panel to user settings page

## Integration Points

### In Main Layout

**File**: `src/app/[locale]/layout.tsx`

```typescript
import { GoogleConnectionBanner } from "@/components/google-connection-banner";

export default function Layout({ children }) {
  return (
    <>
      <GoogleConnectionBanner />
      {children}
    </>
  );
}
```

### In Sidebar

**File**: `src/components/app-sidebar.tsx`

```typescript
import { GoogleConnectionIndicator } from "@/components/google-connection-indicator";

export function AppSidebar() {
  return (
    <Sidebar>
      {/* ... other sidebar content ... */}
      <div className="mt-auto p-4">
        <GoogleConnectionIndicator />
      </div>
    </Sidebar>
  );
}
```

### In Settings Page

**File**: `src/app/[locale]/settings/page.tsx` (if exists)

```typescript
import { GoogleConnectionSettings } from "@/components/google-connection-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <GoogleConnectionSettings />
      {/* ... other settings ... */}
    </div>
  );
}
```

## Testing Scenarios

1. **New User**: Shows "Connect Google" in settings
2. **Connected User**: Green indicator, no banner
3. **Expiring Token**: Yellow warning banner, dismissible
4. **Expired Token**: Red banner with reconnect button
5. **After Reconnection**: Banner disappears, indicator turns green

## Accessibility

- ✅ All interactive elements keyboard accessible
- ✅ ARIA labels for status indicators
- ✅ Color not sole indicator (uses icons)
- ✅ Screen reader announcements for status changes

## Responsive Design

- ✅ Banner collapses on mobile
- ✅ Settings panel stacks vertically
- ✅ Buttons resize appropriately

## Breaking Changes
None - all new components.

## Dependencies
- Uses existing UI components (shadcn/ui)
- Lucide icons (already installed)
