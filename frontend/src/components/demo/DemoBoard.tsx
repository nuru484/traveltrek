// The demo page's hero: a flight-information board on the night band. The
// board rows are real - each one is a live count from the public API, so the
// board reads differently every time the inventory changes (and says so,
// honestly, when the backend is idle).
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IShowcaseData } from "@/lib/public-api";
import { hasLiveInventory } from "./showcase-logic";

interface BoardRow {
  count: number;
  label: string;
  status: string;
}

/** Two-digit board count - "06", not "6"; boards pad. */
const boardCount = (n: number) => String(n).padStart(2, "0");

const boardRows = (data: IShowcaseData): BoardRow[] => [
  { count: data.tours.length, label: "Tours", status: "Boarding" },
  { count: data.destinations.length, label: "Destinations", status: "Route map" },
  { count: data.hotels.length, label: "Hotels", status: "Open" },
  { count: data.flights.length, label: "Flights", status: "Scheduled" },
  { count: data.reviews.length, label: "Passenger log", status: "Published" },
];

const DemoBoard = ({ data }: { data: IShowcaseData }) => {
  const live = hasLiveInventory(data);

  return (
    <section className="bg-night text-night-foreground">
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground/60">
          <span>Flight information</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 flex-none rounded-full ${
                live ? "bg-accent motion-safe:animate-pulse" : "bg-night-foreground/40"
              }`}
              aria-hidden
            />
            {live ? "Live · revalidates every 5 min" : "Demo idle"}
          </span>
        </p>

        <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          Now <span className="italic">boarding.</span>
        </h1>

        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-xl text-[15px] leading-relaxed text-night-foreground/75 sm:text-base">
            Everything on this page is a real row from the running system,
            served by its public API, not a mockup. Sign in with a demo
            account and book any of it; the dashboard takes over from there.
          </p>

          <div className="flex flex-col gap-3 min-[420px]:flex-row lg:flex-none">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-night-foreground px-7 text-night hover:bg-night-foreground/90"
            >
              <Link href="/login">
                Sign in to book
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-night-foreground/30 bg-transparent px-7 text-night-foreground hover:bg-night-foreground/10 hover:text-night-foreground"
            >
              <Link href="/signup">Create an account</Link>
            </Button>
          </div>
        </div>

        {/* The board itself - live counts, padded like a real terminal display */}
        <div className="mt-10 overflow-hidden rounded-xl border border-night-foreground/15 sm:mt-12">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 border-b border-night-foreground/15 bg-night-foreground/5 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-night-foreground/50 sm:px-5">
            <span>Row</span>
            <span className="text-right">Count</span>
            <span className="w-20 text-right sm:w-24">Status</span>
          </div>
          <ul>
            {boardRows(data).map((row) => (
              <li
                key={row.label}
                className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-6 border-b border-dashed border-night-foreground/10 px-4 py-2.5 last:border-b-0 sm:px-5"
              >
                <span className="truncate font-mono text-xs uppercase tracking-[0.15em] text-night-foreground/85 sm:text-sm">
                  {row.label}
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-night-foreground sm:text-sm">
                  {boardCount(row.count)}
                </span>
                <span className="w-20 text-right font-mono text-[9px] uppercase tracking-[0.15em] text-night-foreground/50 sm:w-24 sm:text-[10px]">
                  {row.count > 0 ? row.status : "-"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default DemoBoard;
