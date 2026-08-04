/**
 * Central site config - canonical URL, brand strings, and SEO defaults.
 * Mirrors the khadys-kitchen-frontend convention: the base URL comes from
 * NEXT_PUBLIC_BASE_URL with a production fallback, trailing slash stripped
 * so `${siteUrl}/path` is always safe.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_BASE_URL || "https://traveltrek.manuru.dev"
).replace(/\/$/, "");

export const siteConfig = {
  name: "Travel Trek",
  /** Full home-page title (the layout template's `default`). */
  title: "Travel Trek - travel & tour booking platform",
  /** ≤125 chars so Google (~155), X (~200), and social previews (~125)
   *  all show it untruncated. */
  description:
    "A travel and tour booking platform: flights, hotels, tours, and secure payments in one place.",
  author: "Nurudeen Abdul-Majeed",
  /** Paper + ink from globals.css, as hex for manifest/theme-color. */
  backgroundColor: "#f6f8fb",
  themeColor: "#16233a",
} as const;
