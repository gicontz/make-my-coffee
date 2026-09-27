// Freshness is a food claim, so these tests guard what we must NOT say as much
// as what we do.
//
// Two sentences are deliberately absent from the site: how long a sealed
// bottle keeps, and whether to refrigerate after opening. Neither is recorded
// anywhere. The failure this file exists to catch is someone — or the model —
// filling one of those gaps with a plausible-sounding number, because on a
// perishable that is not a copy bug, it is an unfounded safety claim on a live
// storefront.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  AFTER_OPENING,
  DAYS_AFTER_OPENING,
  FRESHNESS_SUMMARY,
  MADE_TO_ORDER,
  TRANSIT_STORAGE,
} from '../lib/freshness.ts'

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

test('the after-opening window is framed as flavour, not safety', () => {
  // The customer called it "just a best-day-before thing". Presenting a
  // quality window as a use-by date is its own inaccuracy.
  assert.match(AFTER_OPENING, /flavour|flavor/i)
  assert.match(AFTER_OPENING, /not safety/i)
  assert.ok(
    !/use by|use-by|expir|unsafe|spoil/i.test(AFTER_OPENING),
    'the after-opening copy must not read as a safety deadline'
  )
})

test('no freshness copy claims an unopened shelf life', () => {
  // Nothing may say how long a SEALED bottle keeps — it is not known.
  for (const [name, copy] of Object.entries({ MADE_TO_ORDER, TRANSIT_STORAGE, AFTER_OPENING })) {
    assert.ok(
      !/unopened|sealed|before opening/i.test(copy),
      `${name} appears to make a claim about unopened bottles, which we cannot support`
    )
  }
})

test('no freshness copy tells the customer where to keep it', () => {
  // Same-day delivery was ruled out as needing a cold chain. The customer's
  // own kitchen was never covered either way.
  assert.ok(
    !/(fridge|refrigerate|chilled|cool, dry)/i.test(AFTER_OPENING),
    'AFTER_OPENING must not give storage instructions we do not have'
  )
  // TRANSIT_STORAGE may mention refrigeration only to say it is unnecessary
  // *in transit*, and only because delivery is same-day.
  assert.match(TRANSIT_STORAGE, /same day/i)
})

test('the bot is explicitly barred from inventing either missing fact', () => {
  const assistant = read('../lib/chat/assistant.ts')
  assert.match(assistant, /FRESHNESS_SUMMARY/, 'the prompt must state the freshness facts it is allowed to use')
  assert.match(
    assistant,
    /Never state how long a SEALED, unopened bottle keeps/,
    'the prompt must forbid inventing an unopened shelf life'
  )
  assert.match(
    assistant,
    /never say whether it should be refrigerated after opening/,
    'the prompt must forbid inventing storage guidance'
  )
})

test('no surface retypes the freshness facts', () => {
  // The ₱1,000 threshold taught this the hard way: three pages restated a
  // value instead of importing it, and all three went stale in one commit.
  for (const file of [
    '../app/(storefront)/shop/page.tsx',
    '../app/(storefront)/shop/[id]/page.tsx',
  ]) {
    const source = read(file)
    assert.match(source, /from '@\/lib\/freshness'/, `${file} must import the freshness copy`)
    assert.ok(
      !new RegExp(`${DAYS_AFTER_OPENING}\\s*days`, 'i').test(source),
      `${file} hardcodes the after-opening window instead of importing it`
    )
  }
})

test('the summary is the three facts, in reading order', () => {
  assert.equal(FRESHNESS_SUMMARY, `${MADE_TO_ORDER} ${TRANSIT_STORAGE} ${AFTER_OPENING}`)
})
