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
  /** ≤130 chars so Google (~155), X (~200), and social previews (~125)
   *  all show it untruncated. */
  description:
    "A production-ready travel booking platform — flights, hotels, tours, and payments — built end-to-end by Nurudeen Abdul-Majeed.",
  author: "Nurudeen Abdul-Majeed",
  /** Paper + ink from globals.css, as hex for manifest/theme-color. */
  backgroundColor: "#f6f8fb",
  themeColor: "#16233a",
} as const;
