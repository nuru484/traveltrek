/**
 * Central site config — canonical URL, brand strings, and SEO defaults.
 * Mirrors the khadys-kitchen-frontend convention: the base URL comes from
 * NEXT_PUBLIC_BASE_URL with a production fallback, trailing slash stripped
 * so `${siteUrl}/path` is always safe.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_BASE_URL || "https://traveltrek.dagraroyal.org"
).replace(/\/$/, "");

export const siteConfig = {
  name: "Travel Trek",
  /** Full home-page title (the layout template's `default`). */
  title: "Travel Trek — a travel booking platform, built end-to-end",
  description:
    "A production-ready travel booking system — flights, hotels, tours and payments — with secure authentication, real-time availability, and a full admin layer. A full-stack portfolio case study by Nurudeen Abdul-Majeed.",
  author: "Nurudeen Abdul-Majeed",
  /** Paper + ink from globals.css, as hex for manifest/theme-color. */
  backgroundColor: "#f6f8fb",
  themeColor: "#16233a",
} as const;
