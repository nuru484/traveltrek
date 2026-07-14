// src/components/ui/ErrorMessage.tsx
import React from "react";

interface ErrorMessageProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}

/**
 * Reusable error state in the landing page's document voice: a mono status
 * eyebrow, serif heading, plain message, and an ink pill retry. No icons —
 * the vocabulary is typographic.
 */
const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  title = "Something went wrong",
  className = "",
}) => {
  const getErrorMessage = (error: unknown): string => {
    if (typeof error === "string") return error;
    if (error instanceof Error) return error.message;
    return "An unexpected error occurred. Please try again.";
  };

  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Unexpected turbulence
      </p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {getErrorMessage(error)}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-7 inline-flex cursor-pointer items-center rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 active:bg-foreground/95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Try again
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
