// The drink recipes, stated once.
//
// These used to be an array inside the homepage, which rendered them as cards
// and nothing more — no URL to rank, link to or share. They now back both the
// homepage cards and one page per recipe (/recipes/[slug]), so the two cannot
// disagree about how many shots a drink takes.
//
// ⚠️ No peso figure belongs in this file. What a drink costs is derived from
// lib/products.ts by recipeCoffeeCost(), so a price change can't leave a
// recipe quoting the old one. Nor does anything about how long the coffee
// keeps — that is a food claim, and recipes are not where it is made.
//
// Images are not here: a static image import can't load under the plain-Node
// test runner, so the page maps slugs to images itself (see RECIPE_IMAGES).

import { SHOT_ML, pricePerShot, products, type Product } from './products.ts'

export interface Recipe {
  /** The URL segment — /recipes/<slug>. Changing it breaks every link to the page. */
  slug: string
  name: string
  /** Shots of Aconchego in one drink. The ingredient line is built from this. */
  shots: number
  /** The rest of the homepage card's one-liner, after the shot count. */
  pairsWith: string
  /** The homepage card's tagline. */
  note: string
  served: 'hot' | 'iced'
  prepMinutes: number
  /** The page's <title>, written for the search it should answer. */
  title: string
  /** Meta description and intro. Cost is appended by the page, never typed here. */
  description: string
  /** Everything except the espresso — that line comes from `shots`. */
  ingredients: readonly string[]
  steps: readonly string[]
  /** An optional variation, rendered after the method. */
  tip?: string
  keywords: readonly string[]
}

const RECIPES = [
  {
    slug: 'classic-latte',
    name: 'Classic Latte',
    shots: 1,
    pairsWith: '150ml steamed milk',
    note: 'Smooth, simple, perfect.',
    served: 'hot',
    prepMinutes: 5,
    title: 'Classic latte at home, no espresso machine',
    description:
      'A café-style latte from one bottled espresso shot and warm, frothed milk. No machine, no pods, about five minutes.',
    ingredients: ['150ml fresh milk', 'Sugar or syrup, to taste (optional)'],
    steps: [
      'Heat the milk until it steams but does not boil — about a minute in the microwave, or a few minutes in a small pan over low heat.',
      'Froth it with a handheld frother or a whisk until it turns glossy and doubles slightly in volume.',
      'Pour the espresso shot into a mug.',
      'Pour the hot milk over the shot, holding the foam back with a spoon, then spoon the foam on top.',
      'Sweeten to taste and drink straight away.',
    ],
    keywords: ['latte at home', 'latte without espresso machine', 'espresso without a machine', 'bottled espresso'],
  },
  {
    slug: 'honey-oat-latte',
    name: 'Honey Oat Latte',
    shots: 1,
    pairsWith: 'oat milk · 1 tsp honey',
    note: 'Naturally sweet with a nutty finish.',
    served: 'hot',
    prepMinutes: 5,
    title: 'Honey oat latte at home, no machine',
    description:
      'A dairy-free latte from one bottled espresso shot, oat milk and a spoon of honey. Naturally sweet, nutty, and ready in five minutes.',
    ingredients: ['150ml oat milk', '1 tsp honey'],
    steps: [
      'Warm the oat milk gently until hot — keep it below a boil, or it can turn thick and grainy.',
      'Stir the honey into the warm milk until it disappears.',
      'Froth the milk with a handheld frother or a whisk.',
      'Pour the espresso shot into a mug and pour the honeyed milk over it.',
    ],
    tip: 'Making it iced? Honey won’t dissolve in cold milk — stir it into the espresso shot with a teaspoon of hot water first, then pour over ice and cold oat milk.',
    keywords: ['oat milk latte', 'honey latte', 'dairy-free latte at home', 'espresso without a machine'],
  },
  {
    slug: 'iced-caramel-latte',
    name: 'Iced Caramel Delight',
    shots: 2,
    pairsWith: 'ice · milk · caramel',
    note: 'Cool, rich, and indulgent.',
    served: 'iced',
    prepMinutes: 3,
    title: 'Iced caramel latte at home, no machine',
    description:
      'A double-shot iced caramel latte made from bottled espresso, cold milk and caramel sauce. Café-strength, no machine, three minutes.',
    ingredients: ['A tall glass of ice', '120ml cold milk', '1–2 tbsp caramel sauce'],
    steps: [
      'Drizzle half the caramel around the inside of a tall glass.',
      'Stir the rest of the caramel into the espresso shots — it blends far more easily into coffee than into cold milk.',
      'Fill the glass with ice and pour in the cold milk.',
      'Pour the caramel espresso over the top and watch it sink through the milk. Stir before drinking.',
    ],
    tip: 'Want it less sweet? Skip the stirred-in caramel and keep only the drizzle.',
    keywords: ['iced latte at home', 'iced caramel latte', 'iced coffee recipe', 'espresso without a machine'],
  },
  {
    slug: 'espresso-tonic',
    name: 'Espresso Tonic',
    shots: 1,
    pairsWith: 'tonic water · ice · citrus',
    note: 'Bold meets bright — surprisingly refreshing.',
    served: 'iced',
    prepMinutes: 2,
    title: 'Espresso tonic recipe, no machine',
    description:
      'Bottled espresso floated over ice-cold tonic water with a twist of citrus. Bright, bittersweet and fizzy — two minutes, no machine.',
    ingredients: ['A tall glass of ice', '120ml cold tonic water', 'A slice of orange, or a halved calamansi'],
    steps: [
      'Fill a tall glass with ice and pour in the tonic water.',
      'Pour the espresso shot in slowly, over the back of a spoon, so it settles in a layer on top.',
      'Squeeze in the citrus or drop in the slice. Stir just before you drink.',
    ],
    tip: 'Tonic always goes in first. Pour espresso into an empty glass and add tonic on top, and the fizz foams straight over the rim.',
    keywords: ['espresso tonic', 'coffee tonic', 'iced espresso drink', 'espresso without a machine'],
  },
] as const satisfies readonly Recipe[]

/** The slugs that exist — so a map keyed by recipe (images) must cover every one. */
export type RecipeSlug = (typeof RECIPES)[number]['slug']

export const recipes: readonly (Recipe & { slug: RecipeSlug })[] = RECIPES

/** Find a recipe by the slug used in its URL. */
export function recipeBySlug(slug: string): (Recipe & { slug: RecipeSlug }) | undefined {
  return recipes.find(r => r.slug === slug)
}

/** "1 shot" / "2 shots". */
export function shotsLabel(recipe: Pick<Recipe, 'shots'>): string {
  return `${recipe.shots} ${recipe.shots === 1 ? 'shot' : 'shots'}`
}

/** The homepage card's one-liner — the shot count read from `shots`, not retyped. */
export function recipeSummary(recipe: Pick<Recipe, 'shots' | 'pairsWith'>): string {
  return `${shotsLabel(recipe)} · ${recipe.pairsWith}`
}

/** The full ingredient list, espresso first. */
export function recipeIngredients(recipe: Pick<Recipe, 'shots' | 'ingredients'>): string[] {
  const espresso = `${shotsLabel(recipe)} of Aconchego espresso (${recipe.shots * SHOT_ML}ml)`
  return [espresso, ...recipe.ingredients]
}

/**
 * What the espresso in one of these drinks costs, from a given bottle.
 *
 * Built on pricePerShot() rather than its own division so the figure on a
 * recipe page is visibly the per-drink figure on the product page times the
 * shots — a reader checking the arithmetic gets the same answer. Milk, ice and
 * syrup are the customer's and not counted, same as pricePerShot.
 */
export function recipeCoffeeCost(recipe: Pick<Recipe, 'shots'>, product: Pick<Product, 'price' | 'shots'>): number {
  return pricePerShot(product) * recipe.shots
}

/** Whole drinks one bottle makes. A 7-shot bottle makes three double-shot drinks, not 3.5. */
export function drinksPerBottle(recipe: Pick<Recipe, 'shots'>, product: Pick<Product, 'shots'>): number {
  return Math.floor(product.shots / recipe.shots)
}

/** The cheapest the espresso in this drink gets, across every bottle. */
export function lowestCoffeeCost(recipe: Pick<Recipe, 'shots'>): number {
  return Math.min(...products.map(p => recipeCoffeeCost(recipe, p)))
}
