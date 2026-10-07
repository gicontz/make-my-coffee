import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import bottleImg from '@/app/assets/bottle.png'
import { products } from '@/lib/products'
import {
  drinksPerBottle,
  lowestCoffeeCost,
  recipeBySlug,
  recipeCoffeeCost,
  recipeIngredients,
  recipes,
  shotsLabel,
} from '@/lib/recipes'
import { SITE_NAME, pageMeta } from '@/lib/seo'
import { siteUrl } from '@/lib/siteUrl'
import { RECIPE_IMAGES } from '../images'

const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' }

// Known at build time, like the product pages — every recipe page is static.
export function generateStaticParams() {
  return recipes.map(r => ({ slug: r.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const recipe = recipeBySlug(params.slug)
  if (!recipe) return {}

  return pageMeta({
    title: recipe.title,
    description: `${recipe.description} Coffee from ₱${lowestCoffeeCost(recipe)} a cup.`,
    path: `/recipes/${recipe.slug}`,
  })
}

/**
 * One page per recipe.
 *
 * The plan's target searches — iced latte at home, espresso without a
 * machine — are recipe-shaped, and a recipe page is the only thing on the
 * site that can answer one. These were homepage cards with no URL.
 *
 * Every peso figure is derived from lib/products.ts; nothing about storage or
 * shelf life appears, for the same reason it is absent from the product pages.
 */
export default function RecipePage({ params }: { params: { slug: string } }) {
  const recipe = recipeBySlug(params.slug)
  if (!recipe) notFound()

  const image = RECIPE_IMAGES[recipe.slug]
  const ingredients = recipeIngredients(recipe)
  const others = recipes.filter(r => r.slug !== recipe.slug)

  const recipeLd = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.name,
    description: recipe.description,
    image: [`${siteUrl()}${image.src}`],
    author: { '@type': 'Organization', name: SITE_NAME },
    recipeCategory: 'Drink',
    recipeYield: '1 drink',
    prepTime: `PT${recipe.prepMinutes}M`,
    totalTime: `PT${recipe.prepMinutes}M`,
    keywords: recipe.keywords.join(', '),
    recipeIngredient: ingredients,
    recipeInstructions: recipe.steps.map(text => ({ '@type': 'HowToStep', text })),
  }

  return (
    <div className="min-h-screen bg-espresso-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(recipeLd) }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-2 text-espresso-400 text-sm mb-8">
          <Link href="/" className="hover:text-espresso-700 transition-colors">Home</Link>
          <span>›</span>
          <span className="text-espresso-700">{recipe.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-white rounded-2xl border border-espresso-100 p-8 flex items-center justify-center lg:self-start lg:sticky lg:top-24">
            <Image
              src={image}
              alt={`${recipe.name}, made with Aconchego espresso`}
              className="w-full max-w-md h-auto object-contain"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </div>

          <div>
            <h1 className="text-espresso-900 text-4xl font-bold mb-2" style={serif}>{recipe.name}</h1>
            <p className="text-espresso-500 italic mb-4">{recipe.note}</p>
            <p className="text-espresso-700 leading-relaxed mb-6">{recipe.description}</p>

            <ul className="flex flex-wrap gap-2 mb-6 text-sm">
              {[shotsLabel(recipe), recipe.served === 'iced' ? 'Iced' : 'Hot', `${recipe.prepMinutes} min`, 'Makes 1'].map(
                chip => (
                  <li
                    key={chip}
                    className="bg-espresso-100 text-espresso-700 px-3 py-1 rounded-full border border-espresso-200 font-medium"
                  >
                    {chip}
                  </li>
                ),
              )}
            </ul>

            <p className="text-espresso-800 text-sm font-semibold mb-8">
              The coffee in it costs from ₱{lowestCoffeeCost(recipe)} — the rest is from your kitchen.
            </p>

            <h2 className="text-espresso-900 text-2xl font-bold mb-3" style={serif}>You’ll need</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-espresso-700 mb-8">
              {ingredients.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h2 className="text-espresso-900 text-2xl font-bold mb-3" style={serif}>Method</h2>
            <ol className="list-decimal pl-5 space-y-3 text-espresso-700 leading-relaxed">
              {recipe.steps.map(step => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            {recipe.tip && (
              <p className="mt-6 bg-white border border-espresso-200 rounded-xl p-4 text-espresso-700 text-sm leading-relaxed">
                <span className="font-semibold text-espresso-900">Tip: </span>
                {recipe.tip}
              </p>
            )}
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-espresso-900 text-2xl font-bold mb-2" style={serif}>Get the shots</h2>
          <p className="text-espresso-600 mb-6">
            Every bottle is the same Aconchego blend — bigger bottles just make each cup cheaper.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {products.map(product => {
              const cups = drinksPerBottle(recipe, product)
              return (
                <Link
                  key={product.id}
                  href={`/shop/${product.id}`}
                  className="flex items-center gap-4 bg-white rounded-2xl border border-espresso-100 hover:border-espresso-400 p-5 transition-colors"
                >
                  <div className="w-16 h-16 bg-espresso-50 rounded-xl flex-shrink-0 relative">
                    <Image src={bottleImg} alt="" fill sizes="64px" className="object-contain p-2" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-espresso-900 font-bold">{product.name}</p>
                    <p className="text-espresso-500 text-sm">
                      ₱{product.price.toLocaleString()} · makes {cups} {cups === 1 ? 'cup' : 'cups'} · ₱
                      {recipeCoffeeCost(recipe, product)} a cup
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-espresso-900 text-2xl font-bold mb-6" style={serif}>More to try</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {others.map(other => (
              <Link
                key={other.slug}
                href={`/recipes/${other.slug}`}
                className="flex items-center gap-4 bg-white rounded-2xl border border-espresso-100 hover:border-espresso-400 p-5 transition-colors"
              >
                <div className="w-16 h-16 bg-espresso-50 rounded-xl flex-shrink-0 relative">
                  <Image src={RECIPE_IMAGES[other.slug]} alt="" fill sizes="64px" className="object-contain p-1" />
                </div>
                <div className="min-w-0">
                  <p className="text-espresso-900 font-bold">{other.name}</p>
                  <p className="text-espresso-500 text-sm">{other.note}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
