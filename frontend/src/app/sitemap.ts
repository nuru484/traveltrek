import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * The landing page and the live demo are the only public, indexable
 * surfaces — everything else sits behind authentication.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${siteUrl}/demo`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
