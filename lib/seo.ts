// Page metadata in one place.
//
// Every page carried the same title and description until now, so Google saw
// one duplicated page and had nothing to tell apart — the marketing plan's
// second blocker. Titles and descriptions live here so a product name or a
// claim about the blend changes in one file rather than five.

import type { Metadata } from 'next'
import { siteUrl } from './siteUrl.ts'

export const SITE_NAME = 'Make My Coffee'

/**
 * The blend, stated once.
 *
 * The site previously described it as "Brazilian" in its meta description
 * while the page itself said Cambodia and Indonesia — a contradiction Google
 * showed in the snippet, and a labelling risk on a food product. One constant
 * so the two can never disagree again.
 */
export const BLEND_ORIGIN = 'Cambodia & Indonesia'

const OG_IMAGE = '/og-image.png'

interface PageMetaInput {
  title: string
  description: string
  path: string
  /** Pages that should not be indexed — a cart holds nothing to rank. */
  noindex?: boolean
}

/** Builds a page's metadata with canonical URL, Open Graph and Twitter card. */
export function pageMeta({ title, description, path, noindex }: PageMetaInput): Metadata {
  const url = `${siteUrl()}${path}`
  return {
    title,
    description,
    alternates: { canonical: url },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'en_PH',
      type: 'website',
      images: [{ url: `${siteUrl()}${OG_IMAGE}`, width: 1200, height: 630, alt: `${SITE_NAME} — Aconchego espresso shots` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${siteUrl()}${OG_IMAGE}`],
    },
  }
}
