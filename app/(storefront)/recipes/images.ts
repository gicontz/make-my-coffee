import type { StaticImageData } from 'next/image'
import type { RecipeSlug } from '@/lib/recipes'
import classicLatte from '@/app/assets/flavors/classic_latte.png'
import honeyOat from '@/app/assets/flavors/honey_oat.png'
import caramel from '@/app/assets/flavors/caramel.png'
import tonic from '@/app/assets/flavors/tonic.png'

// Kept apart from lib/recipes.ts because a static image import won't load
// under the plain-Node test runner. Keyed by RecipeSlug, so a recipe added
// without an image is a type error rather than a broken page.
export const RECIPE_IMAGES: Record<RecipeSlug, StaticImageData> = {
  'classic-latte': classicLatte,
  'honey-oat-latte': honeyOat,
  'iced-caramel-latte': caramel,
  'espresso-tonic': tonic,
}
