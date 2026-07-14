// src/components/ui/EmptyState.tsx
import React from "react";

interface EmptyStateProps {
  /** Mono status line above the heading, e.g. "Nothing scheduled". */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Optional action (button/link) rendered under the copy. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Reusable empty state in the landing page's document voice — typographic,
 * no icons: mono eyebrow, serif heading, plain description.
 */
export function EmptyState({
  eyebrow = "Nothing here yet",
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {eyebrow}
      </p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}

export default EmptyState;
