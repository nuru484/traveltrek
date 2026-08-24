// Shared chrome and typography for the legal documents (/privacy-policy and
// /terms-of-service). Server component: the documents are static prose, so
// they ship no JS beyond the top bar. The section helpers keep both pages on
// one type scale so the documents never drift apart visually.
import type { ReactNode } from "react";
import Link from "next/link";
import DemoTopBar from "@/components/demo/DemoTopBar";
import Footer from "@/components/index/Footer";

const LegalPageShell = ({
  title,
  lastUpdated,
  crossLink,
  children,
}: {
  title: string;
  lastUpdated: string;
  crossLink: { href: string; label: string };
  children: ReactNode;
}) => (
  <div className="min-h-screen bg-background">
    <DemoTopBar />

    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
        Portfolio demonstration · Legal
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
        {title}
      </h1>
      <p className="mb-10 mt-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Last updated:</span>{" "}
        {lastUpdated}
      </p>

      {children}

      <div className="mt-14 border-t border-foreground/15 pt-6 text-sm text-muted-foreground">
        <p>
          See also the{" "}
          <Link
            href={crossLink.href}
            className="font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {crossLink.label}
          </Link>
          , or{" "}
          <Link
            href="/"
            className="font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            return to the landing page
          </Link>
          .
        </p>
      </div>
    </div>

    <Footer numbered={false} />
  </div>
);

/** A numbered document section with consistent spacing. */
export const LegalSection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className="mb-8">
    <h2 className="mb-3 text-xl font-semibold sm:text-2xl">{title}</h2>
    {children}
  </section>
);

/** Body paragraph on the document's shared type style. */
export const LegalText = ({ children }: { children: ReactNode }) => (
  <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
    {children}
  </p>
);

/** Bulleted list on the document's shared type style. */
export const LegalList = ({ items }: { items: ReactNode[] }) => (
  <ul className="mb-3 ml-5 list-disc space-y-1.5 text-[15px] leading-relaxed text-muted-foreground">
    {items.map((item, index) => (
      <li key={index}>{item}</li>
    ))}
  </ul>
);

/** Inline emphasis that reads as a label inside muted body text. */
export const LegalStrong = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-foreground">{children}</strong>
);

/** Inline link with the document's shared link treatment. */
export const LegalLink = ({
  href,
  external = false,
  children,
}: {
  href: string;
  external?: boolean;
  children: ReactNode;
}) =>
  external ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      {children}
    </a>
  ) : (
    <Link
      href={href}
      className="font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      {children}
    </Link>
  );

export default LegalPageShell;
