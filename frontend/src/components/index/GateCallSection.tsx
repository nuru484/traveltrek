// The gate call: the landing page's hand-off to the live demo, which lives
// on its own page (/demo) so this one can stay a portfolio piece. One night
// card in the boarding-pass vernacular - a gate monitor announcing that the
// system it just described is running right now.
import Link from "next/link";
import { ArrowRight, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";

const GateCallSection = () => (
  <section id="demo" className="scroll-mt-20 bg-hero-band">
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
        04 · Now boarding
      </p>
      <h2 className="mt-3 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl lg:text-[42px]">
        The demo is <span className="italic">live.</span>
      </h2>

      {/* Gate monitor - same night surface as the boarding pass header */}
      <div className="mt-10 overflow-hidden rounded-xl border border-foreground/20 bg-night text-night-foreground sm:mt-14">
        <div className="flex items-center justify-between gap-3 border-b border-night-foreground/15 px-5 py-2.5 sm:px-7">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground/70">
            Gate TT-26
            <Plane className="h-3 w-3" strokeWidth={2} aria-hidden />
            Live demo
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground/70">
            <span
              className="h-1.5 w-1.5 flex-none rounded-full bg-accent motion-safe:animate-pulse"
              aria-hidden
            />
            Boarding
          </span>
        </div>

        <div className="flex flex-col gap-6 px-5 py-7 sm:px-7 sm:py-8 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-xl text-[15px] leading-relaxed text-night-foreground/75 sm:text-base">
            Real tours, hotels, flights and reviews from the running system,
            served by its public API. Browse the inventory, then sign in with a
            demo account and book any of it.
          </p>

          <div className="flex flex-col gap-3 min-[420px]:flex-row lg:flex-none">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-night-foreground px-7 text-night hover:bg-night-foreground/90"
            >
              <Link href="/demo">
                Enter the live demo
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-night-foreground/30 bg-transparent px-7 text-night-foreground hover:bg-night-foreground/10 hover:text-night-foreground"
            >
              <Link href="/login">Demo accounts</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default GateCallSection;
