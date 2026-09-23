import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/siteUrl'

/**
 * Served at /robots.txt.
 *
 * /admin and /api are disallowed because neither is for readers — the admin is
 * behind a login and the API returns JSON. This is housekeeping, not security:
 * robots.txt is a request, and the actual protection is middleware.ts and the
 * session check in each route.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/cart', '/order'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
