// src/utils/extractApiError.ts
interface ApiErrorResult {
  message: string;
  fieldErrors?: Record<string, string>;
  hasFieldErrors: boolean;
  errorId?: string;
  code?: string;
}

/** The one message every "can't talk to the server" failure collapses to. */
const NETWORK_MESSAGE =
  "Can't reach the server right now. Check your internet connection and try again.";

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/** Browser/engine network error strings that mean nothing to a person. */
const isBrowserNetworkMessage = (message: string): boolean =>
  /failed to fetch|networkerror|network error|load failed|fetch failed|ERR_NETWORK|ERR_CONNECTION/i.test(
    message,
  );

export const extractApiErrorMessage = (error: unknown): ApiErrorResult => {
  if (!error) {
    return { message: FALLBACK_MESSAGE, hasFieldErrors: false };
  }

  // Handle string errors
  if (typeof error === "string") {
    return {
      message: isBrowserNetworkMessage(error) ? NETWORK_MESSAGE : error,
      hasFieldErrors: false,
    };
  }

  // Handle RTK Query or API errors
  if (typeof error === "object" && error !== null) {
    // RTK Query FETCH_ERROR (server down, no network, DNS…). The raw cause
    // is developer-speak ("TypeError: Failed to fetch") — never show it.
    if ("status" in error && error.status === "FETCH_ERROR") {
      return {
        message: NETWORK_MESSAGE,
        hasFieldErrors: false,
      };
    }

    // Handle RTK Query PARSING_ERROR
    if ("status" in error && error.status === "PARSING_ERROR") {
      return {
        message:
          "The server sent an unexpected response. Please try again in a moment.",
        hasFieldErrors: false,
      };
    }

    // Handle RTK Query TIMEOUT_ERROR
    if ("status" in error && error.status === "TIMEOUT_ERROR") {
      return {
        message:
          "The request took too long. Please check your connection and try again.",
        hasFieldErrors: false,
      };
    }

    // RTK Query error with status and data (API responses from your backend)
    if ("status" in error && "data" in error) {
      const { data } = error;

      if (typeof data === "string") {
        return { message: data, hasFieldErrors: false };
      }

      if (data && typeof data === "object") {
        // Handle your backend's error structure
        if ("status" in data && data.status === "error") {
          const result: ApiErrorResult = {
            message:
              "message" in data && typeof data.message === "string"
                ? data.message
                : "An error occurred",
            hasFieldErrors: false,
          };

          // Add error ID and code if available (non-production)
          if ("errorId" in data && typeof data.errorId === "string") {
            result.errorId = data.errorId;
          }
          if ("code" in data && typeof data.code === "string") {
            result.code = data.code;
          }

          // Check for field-specific validation errors in details.errors (your format)
          if (
            "details" in data &&
            data.details &&
            typeof data.details === "object" &&
            "errors" in data.details &&
            Array.isArray(data.details.errors)
          ) {
            const fieldErrors: Record<string, string[]> = {};

            // Group errors by field
            data.details.errors.forEach((error: unknown) => {
              if (
                error &&
                typeof error === "object" &&
                "field" in error &&
                "message" in error &&
                typeof error.field === "string" &&
                typeof error.message === "string"
              ) {
                if (!fieldErrors[error.field]) {
                  fieldErrors[error.field] = [];
                }
                fieldErrors[error.field].push(error.message);
              }
            });

            if (Object.keys(fieldErrors).length > 0) {
              // Convert to the expected format (first error message for each field)
              const formattedFieldErrors: Record<string, string> = {};
              Object.entries(fieldErrors).forEach(([field, messages]) => {
                formattedFieldErrors[field] = messages[0]; // Use first error message
                // Or join multiple messages: messages.join(', ')
              });

              result.fieldErrors = formattedFieldErrors;
              result.hasFieldErrors = true;
            }
          }

          // Also check for field errors in details.fieldErrors (object format - fallback)
          if (
            "details" in data &&
            data.details &&
            typeof data.details === "object" &&
            "fieldErrors" in data.details &&
            typeof data.details.fieldErrors === "object" &&
            data.details.fieldErrors !== null
          ) {
            const fieldErrors: Record<string, string> = {};
            let hasValidFieldErrors = false;

            Object.entries(data.details.fieldErrors).forEach(
              ([field, messages]) => {
                if (Array.isArray(messages) && messages.length > 0) {
                  fieldErrors[field] = messages[0];
                  hasValidFieldErrors = true;
                } else if (typeof messages === "string") {
                  fieldErrors[field] = messages;
                  hasValidFieldErrors = true;
                }
              }
            );

            if (hasValidFieldErrors) {
              result.fieldErrors = fieldErrors;
              result.hasFieldErrors = true;
            }
          }

          return result;
        }

        // Handle field-specific validation errors (legacy format or other APIs)
        if (
          "errors" in data &&
          typeof data.errors === "object" &&
          data.errors !== null
        ) {
          const fieldErrors: Record<string, string> = {};
          let hasValidFieldErrors = false;

          Object.entries(data.errors).forEach(([field, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              fieldErrors[field] = messages[0];
              hasValidFieldErrors = true;
            } else if (typeof messages === "string") {
              fieldErrors[field] = messages;
              hasValidFieldErrors = true;
            }
          });

          if (hasValidFieldErrors) {
            const generalMessage =
              "message" in data && typeof data.message === "string"
                ? data.message
                : "Validation failed";

            return {
              message: generalMessage,
              fieldErrors,
              hasFieldErrors: true,
            };
          }
        }

        // Handle general error messages
        if ("message" in data && typeof data.message === "string") {
          return { message: data.message, hasFieldErrors: false };
        }
        if ("error" in data && typeof data.error === "string") {
          return { message: data.error, hasFieldErrors: false };
        }

        // Handle array of errors (non-field specific)
        if ("errors" in data && Array.isArray(data.errors)) {
          const message = data.errors
            .map((e: { message?: string }) => e.message || String(e))
            .join(", ");
          return { message, hasFieldErrors: false };
        }
      }

      // HTTP status codes with no usable response body — say what the person
      // can do about it, not what the protocol called it.
      if (typeof error.status === "number") {
        const statusMessages: Record<number, string> = {
          400: "That request couldn't be processed. Please review and try again.",
          401: "Your session has expired. Please sign in again.",
          403: "You don't have permission to do that.",
          404: "We couldn't find what you were looking for.",
          429: "Too many attempts. Please wait a moment and try again.",
          500: "Something went wrong on our side. Please try again.",
          502: "The server is temporarily unavailable. Please try again in a moment.",
          503: "The server is temporarily unavailable. Please try again in a moment.",
          504: "The server is temporarily unavailable. Please try again in a moment.",
        };

        const message =
          statusMessages[error.status] ||
          "Something went wrong. Please try again.";
        return { message, hasFieldErrors: false };
      }
    }

    // JavaScript Error or objects with message — translate browser network
    // errors ("Failed to fetch", "NetworkError", "Load failed") to the
    // friendly copy; pass anything else through.
    if ("message" in error && typeof error.message === "string") {
      return {
        message: isBrowserNetworkMessage(error.message)
          ? NETWORK_MESSAGE
          : error.message,
        hasFieldErrors: false,
      };
    }

    // Handle cases where error is an object but doesn't match expected patterns
    if ("error" in error && typeof error.error === "string") {
      return {
        message: isBrowserNetworkMessage(error.error)
          ? NETWORK_MESSAGE
          : error.error,
        hasFieldErrors: false,
      };
    }
  }

  // Fallback - try to convert to string
  try {
    // A raw JSON blob is developer output, not a message — log it for
    // debugging and show the person something they can act on.
    const stringified = JSON.stringify(error);
    if (stringified && stringified !== "{}") {
      console.error("Unrecognized API error shape:", stringified);
      return { message: FALLBACK_MESSAGE, hasFieldErrors: false };
    }
  } catch {
    // JSON.stringify failed, fall through to final fallback
  }

  return { message: FALLBACK_MESSAGE, hasFieldErrors: false };
};
