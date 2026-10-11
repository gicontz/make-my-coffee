import type { StaticImageData } from 'next/image'
import type { Product } from '@/lib/products'
import { products } from '@/lib/products'
import bottleImg from '@/app/assets/bottle.png'
import fourShots from '@/app/assets/bottles/4shots.png'
import sevenShots from '@/app/assets/bottles/7shots.png'
import tenShots from '@/app/assets/bottles/10shots.png'
import sizeComparison from '@/app/assets/hero_bottles.png'

// Kept apart from lib/products.ts because a static image import won't load
// under the plain-Node test runner. Keyed by Product id.
//
// The three photos share one crop frame, cut from source shots taken at the
// same scale, so a 4-shot really does look smaller than a 10-shot — the whole
// point of #40. Re-cropping one of them on its own breaks that.
const PRODUCT_IMAGES: Record<string, StaticImageData> = {
  '4-shot': fourShots,
  '7-shot': sevenShots,
  '10-shot': tenShots,
}

/** The bottle photo for a product, or the generic bottle if it has none yet. */
export function productImage(id: string): StaticImageData {
  return PRODUCT_IMAGES[id] ?? bottleImg
}

/** Alt text for a product photo, built from the catalog rather than typed. */
export function productImageAlt(product: Pick<Product, 'name' | 'shots' | 'volume'>): string {
  return `${product.name}: a ${product.volume} bottle of ${product.shots} Aconchego espresso shots, black cap, white Make My Coffee label`
}

/** All three bottles in one shot, same scale, left to right in catalog order. */
export const SIZE_COMPARISON_IMAGE = sizeComparison

export const SIZE_COMPARISON_ALT =
  'The three Aconchego bottles side by side, smallest to largest: ' +
  products.map(p => `${p.name} (${p.shots} shots, ${p.volume})`).join(', ')

/**
 * Where each bottle's base sits across SIZE_COMPARISON_IMAGE, as a % of its
 * width, in catalog order. Measured on hero_bottles.png — re-measure if that
 * image is regenerated.
 */
export const SIZE_COMPARISON_X = ['25%', '52%', '82%']
