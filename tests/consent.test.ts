// What a stored consent value means — and, more importantly, what it must
// never be read as.
//
// The failure mode this guards is silent and unfixable after the fact: a
// malformed, truncated or older stored value being read as "yes" would fire
// advertising pixels at someone who never agreed, and nobody would ever see
// it happen. Every uncertain input here must land on null, which the UI
// treats as undecided and therefore loads nothing.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_OFF,
  ALL_ON,
  CONSENT_VERSION,
  categoriesInUse,
  parseConsent,
} from '../lib/analytics.ts'

test('nothing stored means undecided, not consent', () => {
  assert.equal(parseConsent(null), null)
  assert.equal(parseConsent(''), null)
})

test('a v2 answer round-trips exactly', () => {
  const stored = JSON.stringify({ analytics: true, marketing: false, v: CONSENT_VERSION })
  assert.deepEqual(parseConsent(stored), { analytics: true, marketing: false })

  assert.deepEqual(parseConsent(JSON.stringify({ ...ALL_ON, v: CONSENT_VERSION })), ALL_ON)
  assert.deepEqual(parseConsent(JSON.stringify({ ...ALL_OFF, v: CONSENT_VERSION })), ALL_OFF)
})

test('v1 answers carry over without re-asking', () => {
  // v1 was a single yes/no covering analytics and advertising together, so a
  // 'granted' applies faithfully to both categories. Re-asking would be
  // pestering someone who already told us.
  assert.deepEqual(parseConsent('granted'), ALL_ON)
  assert.deepEqual(parseConsent('denied'), ALL_OFF)
})

test('anything we cannot vouch for is treated as undecided', () => {
  for (const raw of [
    'not json',
    '{"analytics":true',                                  // truncated write
    JSON.stringify({ analytics: true, marketing: true }), // no version at all
    JSON.stringify({ analytics: true, marketing: true, v: 1 }),
    JSON.stringify({ analytics: true, marketing: true, v: CONSENT_VERSION + 1 }),
    JSON.stringify(null),
    JSON.stringify('granted'),
  ]) {
    assert.equal(parseConsent(raw), null, `"${raw}" must not be read as an answer`)
  }
})

test('only a literal true is consent', () => {
  // A truthy value is not an agreement. If the shape drifts, the answer is no.
  const stored = JSON.stringify({ analytics: 'yes', marketing: 1, v: CONSENT_VERSION })
  assert.deepEqual(parseConsent(stored), ALL_OFF)
})

test('categories are offered only where a tracker exists', () => {
  assert.deepEqual(categoriesInUse({}), [])
  assert.deepEqual(categoriesInUse({ ga4: 'G-1' }), ['analytics'])
  assert.deepEqual(categoriesInUse({ metaPixel: '1' }), ['marketing'])
  assert.deepEqual(categoriesInUse({ tiktokPixel: '1' }), ['marketing'])
  assert.deepEqual(categoriesInUse({ ga4: 'G-1', metaPixel: '1', tiktokPixel: '2' }), [
    'analytics',
    'marketing',
  ])
})
