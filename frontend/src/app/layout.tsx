import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Montserrat,
  IBM_Plex_Mono,
} from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { StoreProvider } from "./StoreProvider";
import { ThemeProvider } from "@/components/theme-provider";

import { siteConfig, siteUrl as baseUrl } from "@/lib/site";

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Utility face for the landing page's "travel document" details — boarding
// pass fields, departure codes, manifest rows.
const plexMono = IBM_Plex_Mono({
  variable: "--font-mono-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | Travel Trek",
    default: siteConfig.title,
  },
  description: siteConfig.description,
  keywords: [
    "Travel Trek",
    "travel booking platform",
    "travel and tour platform",
    "flight booking system",
    "hotel reservations",
    "tour management",
    "Next.js",
    "Express",
    "PostgreSQL",
    "Nurudeen Abdul-Majeed",
  ],
  authors: [{ name: siteConfig.author }],
  creator: siteConfig.author,
  publisher: siteConfig.author,
  metadataBase: new URL(baseUrl),
  alternates: { canonical: "/" },
  // og:image and twitter:image come from app/opengraph-image.tsx (the
  // boarding-pass card) — listing images here would override it.
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: baseUrl,
    siteName: siteConfig.name,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: next-themes stamps the theme class on <html>
    // before hydration, which is expected to differ from the server HTML.
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${cormorantGaramond.variable} ${montserrat.variable} ${plexMono.variable} antialiased`}
      >
        <StoreProvider>
          {/* Light by default (the public landing is light-only); the
              dashboard's own toggle can still switch signed-in users. */}
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            disableTransitionOnChange
          >
            {/* Toasts follow the app's document voice: card surface, hairline
                border, no drop shadow. Colors come from theme variables so
                dark dashboard views stay legible. */}
            <Toaster
              position="bottom-right"
              reverseOrder={false}
              toastOptions={{
                duration: 5000,
                style: {
                  background: "var(--card)",
                  color: "var(--card-foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  boxShadow: "none",
                  fontSize: "14px",
                },
                success: {
                  iconTheme: {
                    primary: "var(--accent)",
                    secondary: "var(--accent-foreground)",
                  },
                },
                error: {
                  iconTheme: {
                    primary: "var(--destructive)",
                    secondary: "#ffffff",
                  },
                },
              }}
            />
            <main>{children}</main>
          </ThemeProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
