import { api } from "@/trpc/react";

/**
 * Hook to monitor Google connection health
 * Automatically refetches every 5 minutes and on window focus
 */
export function useGoogleConnectionStatus() {
  const { data, isLoading, error, refetch } =
    api.google_analytics.getConnectionStatus.useQuery(undefined, {
      refetchOnWindowFocus: true,
      refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
    });

  return {
    status: data?.status ?? "not_connected",
    isHealthy: data?.isHealthy ?? false,
    needsReconnection: data?.needsReconnection ?? false,
    warningMessage: data?.warningMessage,
    errorReason: data?.errorReason,
    expiresAt: data?.expiresAt,
    scopes: data?.scopes,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to manually test Google connection
 * Makes an actual API call to verify credentials work
 */
export function useTestGoogleConnection() {
  const testMutation = api.google_analytics.testConnection.useMutation();

  const testConnection = async () => {
    try {
      const result = await testMutation.mutateAsync();
      return result;
    } catch (error) {
      console.error("Connection test failed:", error);
      throw error;
    }
  };

  return {
    testConnection,
    testing: testMutation.isPending,
    result: testMutation.data,
    error: testMutation.error,
  };
}

/**
 * Hook to disconnect Google account
 */
export function useDisconnectGoogle() {
  const disconnectMutation =
    api.google_analytics.disconnectGoogle.useMutation();
  const utils = api.useUtils();

  const disconnect = async () => {
    try {
      await disconnectMutation.mutateAsync();
      // Invalidate queries to update UI
      await utils.google_analytics.getConnectionStatus.invalidate();
      await utils.google_analytics.getSelectedProperty.invalidate();
      return { success: true };
    } catch (error) {
      console.error("Disconnect failed:", error);
      throw error;
    }
  };

  return {
    disconnect,
    disconnecting: disconnectMutation.isPending,
    error: disconnectMutation.error,
  };
}
