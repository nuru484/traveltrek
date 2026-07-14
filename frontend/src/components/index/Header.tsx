"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b transition-colors duration-300 ${
        isScrolled || menuOpen
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

          {/* Anchor nav — desktop only; phones get the menu panel */}
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

          <div className="flex flex-none items-center gap-1.5">
            <Button
              asChild
              size="sm"
              className="h-9 px-3 text-xs sm:px-5 sm:text-sm font-medium whitespace-nowrap"
            >
              <Link href="/login">Try the platform</Link>
            </Button>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted/60 active:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
            >
              {menuOpen ? (
                <X className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <Menu className="h-5 w-5" strokeWidth={1.75} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Phone menu panel — stacked document-style links */}
      {menuOpen && (
        <nav className="border-t border-border/60 md:hidden">
          <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between border-b border-dashed border-foreground/15 py-3 text-sm font-medium text-foreground last:border-b-0 active:bg-muted/40"
              >
                {link.label}
                <span
                  aria-hidden
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
};

export default Header;
