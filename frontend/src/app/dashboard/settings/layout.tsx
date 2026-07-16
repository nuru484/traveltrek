// src/app/dashboard/settings/layout.tsx
//
// Account security settings shell (both principals — customers and staff):
// a compact header plus tab navigation over the security surfaces. Server
// component; only the nav (active state) is a client island.
import type * as React from "react";
import SettingsNav from "@/components/settings/SettingsNav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-4 sm:py-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Account · Security
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage how you sign in to your account.
        </p>
      </div>

      <SettingsNav />

      {children}
    </div>
  );
}
