// src/components/ui/DetailPageHeader.tsx
"use client";
import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

function BackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
    >
      <ArrowLeft className="h-4 w-4 flex-none" />
      {label}
    </Link>
  );
}

/**
 * Shared header for detail/create/edit pages: plain title + description with
 * a link-style back control. The back link sits above the title on narrow
 * containers (phones, tablets with the sidebar open) and moves onto the
 * title row once there is room for both without wrapping.
 */
export function DetailPageHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  children,
}: {
  title: string;
  description?: string;
  backHref: string;
  /** Long form shown when the link sits beside the title (e.g. "Back to Hotels"). */
  backLabel?: string;
  /** Optional extra action rendered on the title row (e.g. a Filters trigger). */
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border pb-4 sm:pb-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-2 @2xl/main:hidden">
          <BackLink href={backHref} label="Back" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="min-w-0 text-xl font-bold text-foreground sm:text-2xl">
            {title}
          </h1>
          <div className="flex flex-none items-center gap-2">
            {children}
            <span className="hidden @2xl/main:inline-flex">
              <BackLink href={backHref} label={backLabel} />
            </span>
          </div>
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

export default DetailPageHeader;
