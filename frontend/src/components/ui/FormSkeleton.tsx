// src/components/ui/FormSkeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Structural form loader: labelled field pairs in a responsive grid, a
 * textarea block, and a submit pill — mirrors the real forms instead of one
 * grey slab.
 */
export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="rounded-xl border border-foreground/15 bg-card p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ))}
        <div className="space-y-2 sm:col-span-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
      <Skeleton className="mt-6 h-11 w-full rounded-full sm:w-40" />
    </div>
  );
}

export default FormSkeleton;
