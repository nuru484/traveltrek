import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * The landing page is the only public, indexable surface — everything else
 * sits behind authentication.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
