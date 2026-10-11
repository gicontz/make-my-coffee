// Taking consent back has to stop the trackers, not just our events.
//
// trackConversion re-reads consent, so our own events stop at once. But a
// tracker's script cannot be unloaded, and TikTok's keeps sending its own
// engagement, click and health reports for as long as the page lives — seen on
// the wire after a mid-visit "Reject all". The page reloads instead, and comes
// back without the script. These tests pin when that happens, and that it does.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ALL_OFF, ALL_ON, withdrawsConsent } from '../lib/analytics.ts'

const ALL_IDS = { ga4: 'G-TEST', metaPixel: '1234', tiktokPixel: 'TT-TEST' }

test('turning off a category that was on is a withdrawal', () => {
  assert.equal(withdrawsConsent(ALL_ON, ALL_OFF, ALL_IDS), true)
  assert.equal(withdrawsConsent(ALL_ON, { analytics: true, marketing: false }, ALL_IDS), true)
  assert.equal(withdrawsConsent(ALL_ON, { analytics: false, marketing: true }, ALL_IDS), true)
})

test('granting, re-saving, or a first answer is not', () => {
  assert.equal(withdrawsConsent(null, ALL_OFF, ALL_IDS), false, 'first answer: nothing was loaded')
  assert.equal(withdrawsConsent(null, ALL_ON, ALL_IDS), false)
  assert.equal(withdrawsConsent(ALL_OFF, ALL_ON, ALL_IDS), false, 'granting loads scripts, needs no reload')
  assert.equal(withdrawsConsent(ALL_ON, ALL_ON, ALL_IDS), false, 'saving the same choice')
  assert.equal(withdrawsConsent(ALL_OFF, ALL_OFF, ALL_IDS), false)
})

test('a category with no tracker configured never forces a reload', () => {
  // Only GA4 configured: switching advertising off loaded nothing to begin with.
  const gaOnly = { ga4: 'G-TEST', metaPixel: undefined, tiktokPixel: undefined }
  assert.equal(withdrawsConsent(ALL_ON, { analytics: true, marketing: false }, gaOnly), false)
  assert.equal(withdrawsConsent(ALL_ON, { analytics: false, marketing: true }, gaOnly), true)
})

test('the consent component reloads on withdrawal, and only once the new answer is stored', () => {
  const source = readFileSync(fileURLToPath(new URL('../components/Analytics.tsx', import.meta.url)), 'utf8')
  const decide = source.slice(source.indexOf('const decide'), source.indexOf('}, [])', source.indexOf('const decide')))
  assert.ok(decide, 'decide() not found in components/Analytics.tsx')
  assert.match(decide, /withdrawsConsent\(readConsent\(\), state\)/, 'withdrawal must be judged against the stored answer, before it is overwritten')
  assert.match(decide, /window\.location\.reload\(\)/, 'withdrawing consent must reload the page, or loaded trackers keep running')
  assert.ok(decide.indexOf('writeConsent(state)') < decide.indexOf('window.location.reload()'), 'the new answer must be written before reloading')
  assert.match(decide, /saved\?\.analytics === state\.analytics && saved\?\.marketing === state\.marketing/,
    'reload only when the write stuck — otherwise the reload reads the old "yes" and loads everything again')
})
