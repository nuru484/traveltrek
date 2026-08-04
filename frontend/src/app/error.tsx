"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Route-segment error boundary: a thrown render/data error below the root
 * layout shows this branded fallback instead of a blank screen. Supports both
 * retry prop names across Next 16 minors.
 */
export default function Error({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    // Surface the error for local debugging / an error reporter.
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <div className="grid min-h-dvh place-items-center bg-hero-band px-4 py-16">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-foreground/20 bg-card text-center">
        <div className="flex items-center justify-between bg-night px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground">
          <span>Travel Trek</span>
          <span className="text-night-foreground/70">Status</span>
        </div>
        <div className="px-6 py-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Unexpected turbulence
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            Something went wrong.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            We hit an unexpected error loading this page. Try again. If it
            keeps happening, head back to the start.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 min-[380px]:flex-row">
            {retry && (
              <Button
                onClick={() => retry()}
                className="rounded-full bg-foreground px-6 text-background hover:bg-foreground/90"
              >
                Try again
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              className="rounded-full border-foreground/25 px-6"
            >
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
