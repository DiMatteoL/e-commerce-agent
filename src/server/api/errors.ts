import { TRPCError } from "@trpc/server";
import {
  type GoogleOAuthRequired,
  type GoogleAuthErrorReason,
} from "@/server/google/client";

export type SerializableOAuthError = {
  isOAuthError: true;
  reason: GoogleAuthErrorReason;
  userMessage: string;
  authorizeUrl: string;
  canRetry: boolean;
};

/**
 * Converts GoogleOAuthRequired errors to tRPC errors with preserved metadata
 */
export function handleGoogleOAuthError(err: GoogleOAuthRequired): never {
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: err.userMessage,
    cause: {
      isOAuthError: true,
      reason: err.reason,
      userMessage: err.userMessage,
      authorizeUrl: err.authorizeUrl,
      canRetry: err.canRetry,
    } satisfies SerializableOAuthError,
  });
}

/**
 * Type guard to check if a tRPC error contains OAuth metadata
 */
export function isOAuthError(
  error: unknown,
): error is { cause: SerializableOAuthError } {
  return (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "isOAuthError" in error.cause &&
    error.cause.isOAuthError === true
  );
}
