import { NotFoundActions } from "@/components/ui/not-found-actions";

/** Branded 404 in the landing page's boarding-pass voice. */
export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-hero-band px-4 py-16">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-foreground/20 bg-card text-center">
        <div className="flex items-center justify-between bg-night px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground">
          <span>Travel Trek</span>
          <span className="text-night-foreground/70">404</span>
        </div>
        <div className="px-6 py-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Gate not found
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            This page doesn&apos;t exist.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The address may have changed or never boarded. Head back to the
            landing page to find your way.
          </p>
          <div className="mt-7">
            <NotFoundActions />
          </div>
        </div>
      </div>
    </div>
  );
}
