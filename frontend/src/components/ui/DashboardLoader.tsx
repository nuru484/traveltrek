import Image from "next/image";
import { Plane } from "lucide-react";

/**
 * Full-page branded loader for the dashboard boot (replaces the old
 * all-skeleton screen). TravelTrek's own signature: a plane orbits a dashed
 * route ring around the logo while a runway bar taxis beneath the label.
 * CSS-only (keyframes in globals.css), reduced-motion aware.
 */
export function DashboardLoader() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-8 bg-hero-band px-6">
      <div className="relative grid size-32 place-items-center">
        {/* Dashed route ring, drifting slowly the other way */}
        <div className="tt-route absolute inset-0 rounded-full border-2 border-dashed border-primary/25" />

        {/* Orbiting plane: the wrapper spins; the plane sits on the ring's
            top edge, rotated 45° to fly along the tangent */}
        <div className="tt-orbit absolute inset-0">
          <span className="absolute -top-2 left-1/2 grid size-8 -translate-x-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-md">
            <Plane className="size-4 rotate-45" strokeWidth={2} aria-hidden />
          </span>
        </div>

        {/* Logo on a white chip (the art is dark) */}
        <span className="tt-lift relative grid size-16 place-items-center rounded-2xl bg-white p-2 shadow-sm">
          <Image
            src="/logo.png"
            alt=""
            width={48}
            height={48}
            priority
            className="h-full w-full object-contain"
          />
        </span>
      </div>

      <div className="flex flex-col items-center gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Now boarding
        </p>
        {/* Runway: a lit segment taxis across the strip */}
        <div className="relative h-1 w-40 overflow-hidden rounded-full bg-foreground/10">
          <div className="tt-runway absolute inset-y-0 w-1/3 rounded-full bg-primary" />
        </div>
        <p className="text-sm text-muted-foreground">
          Preparing your dashboard…
        </p>
      </div>
    </div>
  );
}

export default DashboardLoader;
