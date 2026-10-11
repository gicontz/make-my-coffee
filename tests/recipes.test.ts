// Recipe pages exist to rank for searches like "iced latte at home", and each
// one quotes what the coffee in it costs. That figure is the thing most likely
// to go stale, so these tests hold it to lib/products.ts.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SHOT_ML, pricePerShot, productById, products } from '../lib/products.ts'
import {
  drinksPerBottle,
  lowestCoffeeCost,
  recipeBySlug,
  recipeCoffeeCost,
  recipeIngredients,
  recipeSummary,
  recipes,
} from '../lib/recipes.ts'

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

test('slugs are unique and URL-safe', () => {
  const slugs = recipes.map(r => r.slug)
  assert.equal(new Set(slugs).size, slugs.length)
  for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(-[a-z0-9]+)*$/)
})

test('every recipe can be made from every bottle', () => {
  const smallest = Math.min(...products.map(p => p.shots))
  for (const r of recipes) {
    assert.ok(Number.isInteger(r.shots) && r.shots >= 1, `${r.slug}: shots`)
    assert.ok(r.shots <= smallest, `${r.slug} needs more shots than the smallest bottle holds`)
  }
})

test('the espresso line is built from the shot count, never typed', () => {
  for (const r of recipes) {
    const [espresso] = recipeIngredients(r)
    assert.match(espresso, new RegExp(`^${r.shots} shots? of Aconchego espresso \\(${r.shots * SHOT_ML}ml\\)$`))
    assert.ok(recipeSummary(r).startsWith(`${r.shots} shot`))
  }
})

test('no recipe text states a price, a shot count or a storage claim', () => {
  // Prices are derived on the page; a typed one goes stale with the catalog.
  // Shot counts come from `shots`; storage is a food claim made elsewhere.
  for (const r of recipes) {
    const text = [r.title, r.description, r.note, r.pairsWith, r.tip ?? '', ...r.ingredients, ...r.steps].join('\n')
    assert.doesNotMatch(text, /₱|\bpeso/i, `${r.slug} types a price`)
    assert.doesNotMatch(text, /\b\d+\s*shots?\b/i, `${r.slug} retypes a shot count`)
    assert.doesNotMatch(text, /refrigerat|fridge|shelf|keeps for|best before/i, `${r.slug} makes a storage claim`)
  }
})

test('coffee cost is the product page per-drink figure times the shots', () => {
  const reserve = productById('10-shot')!
  const iced = recipeBySlug('iced-caramel-latte')!
  assert.equal(recipeCoffeeCost(iced, reserve), pricePerShot(reserve) * 2)

  for (const r of recipes) {
    for (const p of products) assert.equal(recipeCoffeeCost(r, p), pricePerShot(p) * r.shots)
    assert.equal(lowestCoffeeCost(r), Math.min(...products.map(p => pricePerShot(p) * r.shots)))
  }
})

test('drinks per bottle counts whole drinks only', () => {
  const iced = recipeBySlug('iced-caramel-latte')!
  assert.equal(drinksPerBottle(iced, productById('7-shot')!), 3)
  assert.equal(drinksPerBottle(iced, productById('4-shot')!), 2)
  assert.equal(drinksPerBottle(recipeBySlug('classic-latte')!, productById('7-shot')!), 7)
})

test('unknown slugs find nothing', () => {
  assert.equal(recipeBySlug('mocha'), undefined)
})

test('the sitemap lists the recipe pages', () => {
  const sitemap = read('../app/sitemap.ts')
  assert.match(sitemap, /from '@\/lib\/recipes'/)
  assert.match(sitemap, /recipes\.map\(r => \(\{\s*url: `\$\{base\}\/recipes\/\$\{r\.slug\}`/)
})
