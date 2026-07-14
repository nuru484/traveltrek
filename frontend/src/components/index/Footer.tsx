import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";

const CONTACT_EMAIL = "abdulmajeednurudeen48@gmail.com";

const Footer = () => (
  <footer id="contact" className="scroll-mt-20 bg-night text-night-foreground">
    <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[oklch(0.75_0.13_230)]">
        04 · Crew of one
      </p>

      <div className="mt-3 grid grid-cols-1 gap-10 pb-14 lg:grid-cols-[1.2fr_1fr] lg:gap-16 sm:pb-20">
        <div>
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Nurudeen Abdul-Majeed
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-night-foreground/65">
            Full-stack developer in Tamale, Ghana — available for remote work.
            Travel Trek is one project; the approach travels.
          </p>
          <div className="mt-7 flex flex-col gap-3 min-[420px]:flex-row">
            <Button
              asChild
              className="rounded-full bg-night-foreground px-6 text-night hover:bg-night-foreground/90"
            >
              <a href={`mailto:${CONTACT_EMAIL}`}>Get in touch</a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-white/25 bg-transparent px-6 text-night-foreground hover:bg-white/10 hover:text-night-foreground"
            >
              <Link
                href="https://manuru.dev"
                target="_blank"
                rel="noopener noreferrer"
              >
                View portfolio
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 min-[480px]:grid-cols-2">
          <div>
            <h3 className="font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[oklch(0.75_0.13_230)]">
              Contact
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-night-foreground/80">
              <li>
                {/* The address itself lives behind the link (and the "Get in
                    touch" button) — no 34-char string to wrap on phones. */}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex items-center gap-1 hover:text-night-foreground transition-colors"
                >
                  Email
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </a>
              </li>
              <li>
                <a
                  href="tel:+233546488115"
                  className="hover:text-night-foreground transition-colors"
                >
                  +233 54 648 8115
                </a>
              </li>
              <li>
                <Link
                  href="https://github.com/nuru484"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-night-foreground transition-colors"
                >
                  GitHub
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[oklch(0.75_0.13_230)]">
              Location
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-night-foreground/80">
              <li>Tamale, Ghana</li>
              <li>Remote-ready · GMT</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-white/10 py-6 text-night-foreground/55 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
        <p className="text-xs">© 2026 Nurudeen Abdul-Majeed</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em]">
          TT-2026 · Built to show full-stack range
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
