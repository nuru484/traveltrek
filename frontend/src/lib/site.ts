/**
 * Central site config - canonical URL, brand strings, and SEO defaults.
 * Mirrors the khadys-kitchen-frontend convention: the base URL comes from
 * NEXT_PUBLIC_BASE_URL with a production fallback, trailing slash stripped
 * so `${siteUrl}/path` is always safe.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_BASE_URL || "https://traveltrek.manuru.dev"
).replace(/\/$/, "");

/**
 * The API's own reference page, served by the backend rather than this app.
 * Derived from the same NEXT_PUBLIC_SERVER_URI the data layer uses, so a
 * preview deployment links to its own backend's docs instead of production's.
 * Empty when the backend URL is not configured, which lets callers hide the
 * link rather than render one that goes nowhere.
 */
export const apiDocsUrl = process.env.NEXT_PUBLIC_SERVER_URI
  ? `${process.env.NEXT_PUBLIC_SERVER_URI.replace(/\/$/, "")}/api/docs`
  : "";

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
