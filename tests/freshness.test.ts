// Freshness is a food claim, so these tests guard how it is phrased, not just
// that it is present.
//
// The specific hazard here is that the facts are load-bearing on each other:
// "needs no refrigeration" is true only of the journey, and "7 days" is true
// only refrigerated. Either sentence published alone is wrong. A well-meaning
// edit that trims the copy, or a bot that answers half the question, turns a
// correct pair of statements into an unfounded safety claim on a live
// storefront — which is what this file exists to catch.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  DAYS_FROM_DELIVERY,
  FRESHNESS_SUMMARY,
  MADE_TO_ORDER,
  REFRIGERATE,
  RETURNS,
  SHELF_LIFE,
  TRANSIT_STORAGE,
} from '../lib/freshness.ts'

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

/**
 * Source with comments removed.
 *
 * The comments in these files necessarily quote the facts in order to explain
 * why they must not be split — a doc block saying "the 7-day window is only
 * true refrigerated" is the opposite of the mistake being guarded against, and
 * must not trip the retyping check. Only rendered copy counts.
 */
const rendered = (rel: string) =>
  read(rel)
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

const SURFACES = [
  '../app/(storefront)/shop/page.tsx',
  '../app/(storefront)/shop/[id]/page.tsx',
  '../app/(storefront)/about/page.tsx',
]

test('the window is a best-before, never a use-by', () => {
  assert.match(SHELF_LIFE, /flavour|flavor/i)
  assert.match(SHELF_LIFE, /not safety/i)
  assert.ok(
    !/use by|use-by|expir|unsafe|spoils by|best before date/i.test(SHELF_LIFE),
    'the window must not read as a safety deadline'
  )
})

test('one window covers sealed and opened alike', () => {
  // Two numbers invite a customer to misremember which applies to them, and
  // the honest answer is the same either way.
  const numbers = SHELF_LIFE.match(/\b\d+\b/g) ?? []
  assert.deepEqual(
    numbers,
    [String(DAYS_FROM_DELIVERY)],
    'exactly one day count belongs in the shelf-life copy'
  )
  assert.match(SHELF_LIFE, /opened or not|whether|either/i)
})

test('"no refrigeration" is scoped to the journey, and never stands alone', () => {
  // On its own this reads as "refrigeration is optional" — the opposite of
  // the instruction.
  assert.match(TRANSIT_STORAGE, /on the way|in transit/i)
  assert.match(TRANSIT_STORAGE, /same day/i)
  assert.match(REFRIGERATE, /fridge|refrigerat/i)

  assert.ok(
    FRESHNESS_SUMMARY.includes(TRANSIT_STORAGE) && FRESHNESS_SUMMARY.includes(REFRIGERATE),
    'the summary must carry the no-cold-chain line and the fridge instruction together'
  )

  for (const file of SURFACES) {
    const source = read(file)
    if (!source.includes('TRANSIT_STORAGE')) continue
    assert.ok(
      source.includes('REFRIGERATE') || source.includes('FRESHNESS_SUMMARY'),
      `${file} renders the no-refrigeration line without the fridge instruction`
    )
  }
})

test('the shelf-life claim is never made without the refrigeration condition', () => {
  for (const file of SURFACES) {
    const source = read(file)
    if (!source.includes('SHELF_LIFE')) continue
    assert.ok(
      source.includes('REFRIGERATE') || source.includes('FRESHNESS_SUMMARY'),
      `${file} states the ${DAYS_FROM_DELIVERY}-day window without saying to refrigerate it`
    )
  }
})

test('returns lead with the remedy, not the exclusion', () => {
  assert.match(RETURNS, /photo/i, 'a photo is how a claim is verified without a returns pipeline')
  assert.match(RETURNS, /replace|refund/i)
  assert.ok(
    RETURNS.search(/replace|refund/i) < RETURNS.search(/cannot take back/i),
    'the remedy must come before the exclusion — this is a policy, not a refusal'
  )
  assert.match(RETURNS, /opened/i, 'the exclusion must say which bottles it covers')
})

test('no surface retypes the day count', () => {
  // The ₱1,000 threshold taught this: three pages restated a value instead of
  // importing it, and all three went stale in one commit.
  for (const file of SURFACES) {
    assert.match(read(file), /from '@\/lib\/freshness'/, `${file} must import the freshness copy`)
    assert.ok(
      !new RegExp(`${DAYS_FROM_DELIVERY}[\\s-]*days?`, 'i').test(rendered(file)),
      `${file} hardcodes the window in rendered copy instead of importing it`
    )
  }
})

test('the bot states the facts but cannot settle a claim itself', () => {
  const assistant = read('../lib/chat/assistant.ts')
  assert.match(assistant, /FRESHNESS_SUMMARY/, 'the prompt must carry the freshness facts')
  assert.match(assistant, /RETURNS/, 'the prompt must carry the returns policy')
  assert.match(
    assistant,
    /never call it a use-by or expiry date/i,
    'the prompt must forbid reframing the window as a safety deadline'
  )
  assert.match(
    assistant,
    /Never say refrigeration is optional/i,
    'the prompt must forbid dropping the fridge instruction'
  )
  assert.match(
    assistant,
    /may NOT promise a specific refund, replacement or amount/,
    'settling an actual claim is a person’s decision, not the bot’s'
  )
})

test('made-to-order is stated, since it is the strongest claim we have', () => {
  assert.match(MADE_TO_ORDER, /delivery date you choose/i)
  assert.match(MADE_TO_ORDER, /same day/i)
  assert.ok(FRESHNESS_SUMMARY.startsWith(MADE_TO_ORDER), 'lead with it')
})
