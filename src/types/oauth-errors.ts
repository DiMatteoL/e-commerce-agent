import type { GoogleAuthErrorReason } from "@/server/google/client";

export type OAuthErrorData = {
  isOAuthError: true;
  reason: GoogleAuthErrorReason;
  userMessage: string;
  authorizeUrl: string;
  canRetry: boolean;
};

/**
 * Extract OAuth error metadata from a tRPC error
 */
export function extractOAuthError(error: unknown): OAuthErrorData | null {
  if (
    error &&
    typeof error === "object" &&
    "data" in error &&
    error.data &&
    typeof error.data === "object" &&
    "cause" in error.data &&
    error.data.cause &&
    typeof error.data.cause === "object" &&
    "isOAuthError" in error.data.cause &&
    error.data.cause.isOAuthError === true
  ) {
    return error.data.cause as OAuthErrorData;
  }
  return null;
}

/**
 * Type guard to check if an error is an OAuth error
 */
export function isOAuthError(error: unknown): error is {
  data: { cause: OAuthErrorData };
} {
  return extractOAuthError(error) !== null;
}
