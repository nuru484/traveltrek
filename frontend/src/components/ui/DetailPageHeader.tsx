// src/components/ui/DetailPageHeader.tsx
"use client";
import React from "react";
import { BackButton } from "@/components/ui/BackButton";

/**
 * Shared header for detail/create/edit pages: the back arrow and the page
 * title share one row, and the description sits under them starting at the
 * arrow's own left edge, so nothing below the title is indented by it.
 *
 * `title` names the page, never the record on it - the record's identity
 * belongs to the body.
 */
export function DetailPageHeader({
  title,
  description,
  backHref,
  backLabel = "Go back",
}: {
  title: string;
  description?: string;
  backHref: string;
  /** Accessible name for the arrow (e.g. "Back to hotels"). */
  backLabel?: string;
}) {
  return (
    <div className="border-b border-border pb-4 sm:pb-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <div className="flex min-w-0 items-center gap-1.5">
          <BackButton href={backHref} label={backLabel} />
          <h1 className="min-w-0 text-xl font-bold text-foreground sm:text-2xl">
            {title}
          </h1>
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

export default DetailPageHeader;
