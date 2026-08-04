import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { apiDocsUrl } from "@/lib/site";

const CONTACT_EMAIL = "abdulmajeednurudeen48@gmail.com";

/**
 * `numbered` keeps the landing page's section sequence (…04 · Now boarding,
 * 05 · Crew of one); the demo page renders the same footer without a number
 * since its sections aren't part of that sequence.
 */
const Footer = ({ numbered = true }: { numbered?: boolean }) => (
  <footer id="contact" className="scroll-mt-20 bg-night text-night-foreground">
    <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[oklch(0.75_0.13_230)]">
        {numbered ? "05 · Crew of one" : "Crew of one"}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-10 pb-14 lg:grid-cols-[1.2fr_1fr] lg:gap-16 sm:pb-20">
        <div>
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Nurudeen Abdul-Majeed
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-night-foreground/65">
            Full-stack developer in Tamale, Ghana, available for remote work.
            Travel Trek is one project; the approach travels.
          </p>
          <div className="mt-7">
            <Button
              asChild
              className="rounded-full bg-night-foreground px-6 text-night hover:bg-night-foreground/90"
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
                    touch" button) - no 34-char string to wrap on phones. */}
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
              {/* Served by the API itself, so it is only linkable when the
                  backend URL is configured for this deployment. */}
              {apiDocsUrl && (
                <li>
                  <Link
                    href={apiDocsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-night-foreground transition-colors"
                  >
                    API reference
                    <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </Link>
                </li>
              )}
              <li>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 hover:text-night-foreground transition-colors"
                >
                  Sign in to the demo
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

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-white/10 py-6 text-night-foreground/55">
        <p className="text-xs">© 2026 Nurudeen Abdul-Majeed</p>
        <div className="flex items-center gap-5">
          <Link
            href="/privacy-policy"
            className="text-xs transition-colors hover:text-night-foreground"
          >
            Privacy
          </Link>
          <Link
            href="/terms-of-service"
            className="text-xs transition-colors hover:text-night-foreground"
          >
            Terms
          </Link>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
