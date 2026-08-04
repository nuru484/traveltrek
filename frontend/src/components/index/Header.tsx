"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Compass, Cog, Layers, Mail, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";

// Absolute paths with hashes so the tabs work from /login and /signup too:
// on the landing page they smooth-scroll; elsewhere they navigate home first.
// shortLabel keeps the phone bottom bar's five 9px-mono captions inside their
// cells down to 280px-wide screens.
const NAV_LINKS = [
  { label: "Overview", shortLabel: "Overview", href: "/#overview", icon: Compass },
  { label: "Engineering", shortLabel: "Specs", href: "/#engineering", icon: Cog },
  { label: "Stack", shortLabel: "Stack", href: "/#stack", icon: Layers },
  { label: "Live demo", shortLabel: "Demo", href: "/demo", icon: Ticket },
  { label: "Contact", shortLabel: "Contact", href: "/#contact", icon: Mail },
];

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full border-b transition-colors duration-300 ${
          isScrolled
            ? "bg-background/95 backdrop-blur-lg border-border"
            : "bg-background/80 backdrop-blur-md border-border/60"
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-14 md:h-16 items-center justify-between gap-3">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <Image
                src="/logo.png"
                alt=""
                width={32}
                height={32}
                priority
                className="h-7 w-7 flex-none object-contain md:h-8 md:w-8"
              />
              <span className="font-display text-xl md:text-2xl font-semibold tracking-tight whitespace-nowrap">
                Travel Trek
              </span>
            </Link>

            {/* Anchor nav - desktop only; phones get the bottom bar */}
            <nav className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="py-2 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <Button
              asChild
              size="sm"
              className="h-9 flex-none px-3 text-xs sm:px-5 sm:text-sm font-medium whitespace-nowrap"
            >
              <Link href="/login">Try the platform</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Phone bottom bar - icon tabs, safe-area aware. Pages that render
          this header add pb so the last content isn't covered. */}
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="grid grid-cols-5">
          {NAV_LINKS.map(({ shortLabel, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 py-2.5 text-muted-foreground transition-colors hover:text-foreground active:bg-muted/40"
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              <span className="font-mono text-[9px] uppercase tracking-[0.14em]">
                {shortLabel}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
};

export default Header;
