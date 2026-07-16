// src/components/settings/SettingsNav.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard/settings/password", label: "Password" },
  { href: "/dashboard/settings/two-factor", label: "Two-factor" },
] as const;

/** Tab-style navigation between the security settings surfaces. */
export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="flex gap-6 border-b border-border"
    >
      {ITEMS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
