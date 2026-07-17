"use client";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { useEffect, useSyncExternalStore } from "react";
import { RootState } from "@/redux/store";
import { DashboardLoader } from "@/components/ui/DashboardLoader";

interface ProtectedProps {
  children: React.ReactNode;
}

/** Stable no-op subscription for the mounted useSyncExternalStore below. */
const emptySubscribe = () => () => {};

export default function ProtectRoutes({ children }: ProtectedProps) {
  const user = useSelector((state: RootState) => state.auth.user);
  const router = useRouter();

  // authSlice seeds `user` from localStorage, which the server can't see —
  // SSR always renders the loader. useSyncExternalStore's server snapshot
  // keeps the hydration render on the loader too (no mismatch); the first
  // client-side re-render then swaps in the real layout.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    if (mounted && !user) {
      router.push("/");
    }
  }, [mounted, user, router]);

  if (!mounted || !user) {
    return <DashboardLoader />;
  }

  return <>{children}</>;
}
