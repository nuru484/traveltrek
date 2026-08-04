// Slim header for the demo page: a way back to the portfolio on the left,
// the way into the system on the right. No section tabs - this page is the
// destination, not the pitch.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const DemoTopBar = () => (
  <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-lg">
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="flex h-14 items-center justify-between gap-3 md:h-16">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <ArrowLeft className="h-4 w-4 flex-none" aria-hidden />
          <span className="truncate font-display text-lg font-semibold tracking-tight text-foreground md:text-xl">
            Travel Trek
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] sm:block">
            · Portfolio
          </span>
        </Link>

        <Button
          asChild
          size="sm"
          className="h-9 flex-none whitespace-nowrap px-3 text-xs font-medium sm:px-5 sm:text-sm"
        >
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  </header>
);

export default DemoTopBar;
