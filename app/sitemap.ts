import type { MetadataRoute } from 'next'
import { products } from '@/lib/products'
import { recipes } from '@/lib/recipes'
import { siteUrl } from '@/lib/siteUrl'

/**
 * Served at /sitemap.xml. Built from lib/products.ts and lib/recipes.ts, so a
 * bottle or recipe added or removed there appears or disappears here without
 * anyone remembering to update a list.
 *
 * /cart and /order are left out deliberately: both are noindex, and listing a
 * page you have asked not to be indexed is a mixed signal.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const now = new Date()

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...products.map(p => ({
      url: `${base}/shop/${p.id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...recipes.map(r => ({
      url: `${base}/recipes/${r.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/cookies`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
