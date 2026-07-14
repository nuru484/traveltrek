// src/components/users/UserProfileHeaderSkeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors UserProfileHeader: record strip, avatar + name, field grid. */
export function UserProfileHeaderSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-foreground/15 bg-card">
      <Skeleton className="h-8 w-full rounded-none" />

      <div className="p-4 sm:p-6">
        <div className="flex flex-col items-center gap-4 min-[480px]:flex-row">
          <Skeleton className="h-20 w-20 flex-none rounded-full sm:h-24 sm:w-24" />
          <div className="w-full space-y-2.5 text-center min-[480px]:text-left">
            <Skeleton className="mx-auto h-7 w-48 min-[480px]:mx-0" />
            <div className="flex justify-center gap-1.5 min-[480px]:justify-start">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-dashed border-foreground/20 pt-5 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default UserProfileHeaderSkeleton;
