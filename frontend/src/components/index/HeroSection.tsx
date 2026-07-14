"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github, Plane } from "lucide-react";

/**
 * Dashed flight path drawn under the hero's italic line, ending in a small
 * plane — the page's one accent-colored flourish.
 */
const FlightPath = ({ reduced }: { reduced: boolean }) => (
  <svg
    viewBox="0 0 320 34"
    className="mt-1 h-7 w-[min(72vw,300px)] text-primary"
    aria-hidden
  >
    <motion.path
      d="M6 28 Q 160 -8 292 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeDasharray="1 7"
      strokeLinecap="round"
      initial={reduced ? false : { pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 1.1, delay: 0.5, ease: "easeInOut" }}
    />
    <motion.g
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: reduced ? 0 : 1.5 }}
    >
      <Plane
        x="294"
        y="4"
        width="16"
        height="16"
        strokeWidth={1.75}
        transform="rotate(38 302 12)"
      />
    </motion.g>
  </svg>
);

/** One labelled field on the boarding pass. */
const PassField = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </dt>
    <dd className="mt-0.5 text-[13px] font-medium leading-snug">{value}</dd>
  </div>
);

/** CSS barcode — irregular vertical bars, no image needed. */
const Barcode = () => (
  <div
    aria-hidden
    className="h-9 w-full text-foreground/80"
    style={{
      backgroundImage:
        "repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 5px, currentColor 5px 6px, transparent 6px 8px, currentColor 8px 11px, transparent 11px 15px, currentColor 15px 16px, transparent 16px 19px)",
    }}
  />
);

/**
 * The page's signature: the project's spec sheet rendered as a boarding
 * pass — perforated stub, punched notches, barcode. Every field is real
 * project metadata, not decoration.
 */
const BoardingPass = ({ reduced }: { reduced: boolean }) => (
  <motion.div
    initial={reduced ? false : { opacity: 0, y: 28 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: "spring", stiffness: 110, damping: 16, delay: 0.35 }}
    className="-rotate-[0.4deg]"
  >
    <div className="flex flex-col sm:flex-row overflow-hidden rounded-xl border border-foreground/20 bg-card text-card-foreground">
      {/* Main section */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3 bg-night px-4 py-2.5 text-night-foreground sm:px-5">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
            Travel Trek
            <Plane className="h-3 w-3" strokeWidth={2} aria-hidden />
            Boarding pass
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground/70 whitespace-nowrap">
            2026
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 min-[480px]:grid-cols-3 sm:p-5">
          <PassField label="Passenger" value="Nurudeen Abdul-Majeed" />
          <PassField label="Role" value="Solo — design & engineering" />
          <PassField label="Route" value="Schema → Screen" />
          <PassField label="Type" value="Production booking system" />
          <PassField label="Stack" value="Next.js · Express · PostgreSQL" />
          <div className="min-w-0">
            <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              Status
            </dt>
            <dd className="mt-0.5 flex items-center gap-1.5 text-[13px] font-medium leading-snug">
              <span
                className="h-1.5 w-1.5 flex-none rounded-full bg-accent"
                aria-hidden
              />
              Live & maintained
            </dd>
          </div>
        </dl>
      </div>

      {/* Perforation — punched notches show the band behind the pass */}
      <div className="relative border-t border-dashed border-foreground/25 sm:border-t-0 sm:border-l">
        <span
          aria-hidden
          className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-hero-band sm:left-1/2 sm:top-auto sm:-translate-x-1/2 sm:translate-y-0 sm:-top-2.5"
        />
        <span
          aria-hidden
          className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-hero-band sm:right-auto sm:left-1/2 sm:top-auto sm:-translate-x-1/2 sm:translate-y-0 sm:-bottom-2.5"
        />
      </div>

      {/* Tear-off stub */}
      <div className="flex flex-row items-center gap-4 bg-muted/40 px-4 py-3 sm:w-44 sm:flex-col sm:items-stretch sm:justify-between sm:px-5 sm:py-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Flight
          </span>
          <span className="font-mono text-sm font-semibold tracking-wider">
            TT-2026
          </span>
        </div>
        <div className="min-w-0 flex-1 sm:flex-none">
          <Barcode />
        </div>
        <span className="hidden font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground min-[480px]:block sm:text-center">
          Admit one
        </span>
      </div>
    </div>
  </motion.div>
);

const HeroSection = () => {
  const reduced = useReducedMotion() ?? false;

  const fadeUp = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease: "easeOut" as const },
  });

  return (
    <section className="bg-hero-band">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pb-14 sm:pt-20 lg:pt-24">
        <motion.p
          {...fadeUp(0)}
          className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span
            className="h-1.5 w-1.5 flex-none rounded-full bg-primary"
            aria-hidden
          />
          Travel & tour booking · 2026
        </motion.p>

        <motion.h1
          {...fadeUp(0.08)}
          className="mt-6 max-w-3xl text-[42px] font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl"
        >
          A travel booking platform,
          <span className="block italic">built end-to-end.</span>
        </motion.h1>

        <FlightPath reduced={reduced} />

        <div className="mt-8 flex flex-col gap-8 lg:mt-10 lg:flex-row lg:items-end lg:justify-between">
          <motion.p
            {...fadeUp(0.16)}
            className="max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base"
          >
            Travel Trek is a production-ready booking system — flights, hotels,
            tours and payments — with secure authentication, real-time
            availability, and a full admin layer. Designed and engineered solo,
            from schema to screen.
          </motion.p>

          <motion.div
            {...fadeUp(0.22)}
            className="flex flex-col gap-3 min-[420px]:flex-row lg:flex-none"
          >
            <Button
              asChild
              size="lg"
              className="rounded-full bg-foreground px-7 text-background hover:bg-foreground/90"
            >
              <Link href="/login">
                Try the platform
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-foreground/25 bg-transparent px-7 hover:bg-foreground/5"
            >
              <Link
                href="https://github.com/nuru484/traveltrek"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="mr-1 h-4 w-4" aria-hidden />
                Source code
              </Link>
            </Button>
          </motion.div>
        </div>

        <div className="mt-12 sm:mt-16">
          <BoardingPass reduced={reduced} />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
