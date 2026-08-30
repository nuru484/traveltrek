// src/components/ui/BackButton.tsx
"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Back control for dashboard record pages: an arrow on its own, sitting to
 * the left of the page heading it belongs to. `label` names the destination
 * for assistive technology rather than printing beside the arrow, so the
 * heading keeps the whole row.
 *
 * History carries the visitor back when they arrived in-app; `href` is the
 * fallback on a deep link or a refresh, so the arrow never dead-ends.
 *
 * The plate is 28px so it centres on the title's row, and a pseudo-element
 * pads the hit area out to 40px without taking any layout space - which, with
 * the arrow's own offset, lands flush with the dashboard's phone gutter.
 */
export function BackButton({
  href,
  label = "Go back",
  className,
}: {
  /** Where to go when there is no in-app history. */
  href: string;
  /** Accessible name naming the destination, e.g. "Back to hotels". */
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(href);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={label}
      className={cn(
        "relative -ml-1.5 inline-flex size-7 flex-none cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none transition-colors before:absolute before:top-1/2 before:left-1/2 before:size-10 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] hover:bg-muted/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
    </button>
  );
}

export default BackButton;
