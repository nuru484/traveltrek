"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Absolute paths with hashes so the tabs work from /login and /signup too:
// on the landing page they smooth-scroll; elsewhere they navigate home first.
const NAV_LINKS = [
  { label: "Overview", href: "/#overview" },
  { label: "Engineering", href: "/#engineering" },
  { label: "Stack", href: "/#stack" },
  { label: "Contact", href: "/#contact" },
];

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
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
            className="flex min-w-0 items-baseline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <span className="font-display text-xl md:text-2xl font-semibold tracking-tight whitespace-nowrap">
              Travel Trek
            </span>
          </Link>

          {/* Anchor nav — desktop only; phones get the row below */}
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

          <div className="flex flex-none items-center gap-2">
            <Button
              asChild
              size="sm"
              className="h-9 rounded-full bg-foreground text-background hover:bg-foreground/90 px-3 text-xs sm:px-5 sm:text-sm font-medium whitespace-nowrap"
            >
              <Link href="/login">Try the platform</Link>
            </Button>
          </div>
        </div>

        {/* Phone anchor row — same links, one scrollable line */}
        <nav className="md:hidden -mx-4 px-4 pb-2 flex gap-5 overflow-x-auto no-scrollbar">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground whitespace-nowrap transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default Header;
