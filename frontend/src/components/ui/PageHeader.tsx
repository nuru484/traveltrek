// src/components/ui/PageHeader.tsx
import React from "react";

/**
 * Consistent admin page heading: serif title with an optional muted
 * description beneath, matching the landing page's heading voice.
 */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  /** Optional right-aligned content (rarely needed — actions belong in the FilterBar). */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
