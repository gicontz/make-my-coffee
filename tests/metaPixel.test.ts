// The Meta Pixel must not collect what /privacy says it never receives.
//
// With automatic configuration left on, fbevents.js follows the pixel's
// dashboard settings: "automatic advanced matching" reads the checkout form and
// sends hashed name, email, phone, zip and city with every event, and
// automatic button-click events keep firing after a mid-visit "Reject all".
// Verified against the live pixel config before this guard existed. Nothing in
// the site's own events would show it — only the wire does — so the one line
// that prevents it is pinned here.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../components/Analytics.tsx', import.meta.url)), 'utf8')

test('the Meta Pixel turns automatic configuration off before init', () => {
  const off = source.indexOf("fbq('set','autoConfig',false,'${id}')")
  const init = source.indexOf("fbq('init','${id}')")
  assert.ok(init !== -1, "fbq('init') not found — has the Meta snippet moved?")
  assert.ok(off !== -1, "fbq('set','autoConfig',false,id) is missing: the pixel would scrape the checkout form")
  assert.ok(off < init, 'autoConfig must be set before init, or the dashboard settings apply anyway')
})

test('the Meta Pixel is never told who the customer is', () => {
  // init's third argument is manual advanced matching; 'set userData' is the same by another name.
  assert.doesNotMatch(source, /fbq\('init','\$\{id\}',/, 'fbq(init) must not be passed customer data')
  assert.doesNotMatch(source, /userData/, 'no customer data may be handed to the pixel')
})
