// src/components/dashboard/PageTransition.tsx
"use client";
import { usePathname } from "next/navigation";

/**
 * Route content settles in rather than appearing hard, so moving between a
 * short page and a long one reads as one change instead of a snap. Keyed by
 * pathname so the animation replays on every navigation; the sections inside
 * follow in sequence (see `.stagger`). Reduced motion keeps the fade and
 * drops the movement.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="page-enter stagger" key={pathname}>
      {children}
    </div>
  );
}
