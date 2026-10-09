// /about and the social links are trust signals, so what these tests guard is
// that nothing on them is invented: the blend's origin stated once, the
// founder story absent until it is real, and social links only for accounts
// someone has actually configured.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FOUNDER_SIGNOFF, FOUNDER_STORY } from '../lib/about.ts'
import { BLEND_ORIGIN, BLEND_ORIGIN_LABEL } from '../lib/seo.ts'
import { parseSocialProfiles } from '../lib/social.ts'

const path = (rel: string) => fileURLToPath(new URL(rel, import.meta.url))
const read = (rel: string) => readFileSync(path(rel), 'utf8')

/** Source minus comments — the comments explain the rules by quoting them. */
const code = (rel: string) =>
  read(rel)
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

/** Every storefront page and shared component, as paths relative to this file. */
function storefrontSources(): string[] {
  const under = (dir: string) =>
    (readdirSync(path(dir), { recursive: true }) as string[])
      .filter(f => /\.tsx?$/.test(f))
      .map(f => `${dir}/${f.replace(/\\/g, '/')}`)
  return [...under('../app/(storefront)'), ...under('../components')]
}

test('the blend origin is stated only in BLEND_ORIGIN', () => {
  // A meta description once said "Brazilian" while the page said Cambodia &
  // Indonesia. On a food product that is a labelling risk, not a typo.
  const countries = BLEND_ORIGIN.split(/\s*&\s*/)
  assert.ok(countries.length >= 2)
  const pattern = new RegExp(countries.join('|'), 'i')
  for (const file of storefrontSources()) {
    assert.doesNotMatch(code(file), pattern, `${file} types the blend origin instead of importing BLEND_ORIGIN`)
  }
  assert.equal(BLEND_ORIGIN_LABEL, countries.join(' × '))
})

test('the blend proportions are not disclosed', () => {
  // Deliberately undisclosed — a percentage anywhere near the blend is an invented fact.
  for (const file of ['../app/(storefront)/about/page.tsx', '../lib/seo.ts']) {
    assert.doesNotMatch(code(file), /\d\s*%|percent|\d+\s*:\s*\d+\s*(ratio|blend)/i, `${file} states a proportion`)
  }
})

test('the founder story is either real text or absent', () => {
  if (FOUNDER_STORY === null) {
    assert.equal(FOUNDER_SIGNOFF, null, 'a sign-off without a story credits words nobody wrote')
  } else {
    assert.ok(FOUNDER_STORY.length > 0, 'use null, not an empty list, to hide the section')
    for (const p of FOUNDER_STORY) assert.ok(p.trim().length > 0, 'no empty paragraphs')
    assert.doesNotMatch(FOUNDER_STORY.join(' '), /lorem|ipsum|TODO|TBD|\[.*\]|placeholder/i)
  }
  // The page must not render the section — or any stand-in for it — without one.
  const page = code('../app/(storefront)/about/page.tsx')
  assert.match(page, /\{FOUNDER_STORY && \(/)
  assert.doesNotMatch(page, /coming soon|lorem|placeholder/i)
})

test('social profiles: none configured renders none', () => {
  assert.deepEqual(parseSocialProfiles({}), [])
  assert.deepEqual(parseSocialProfiles({ SOCIAL_FACEBOOK_URL: '  ' }), [])
})

test('social profiles: real URLs on the right network are kept, in a stable order', () => {
  const profiles = parseSocialProfiles({
    SOCIAL_TIKTOK_URL: 'https://www.tiktok.com/@makemycoffee',
    SOCIAL_FACEBOOK_URL: 'https://www.facebook.com/makemycoffee',
  })
  assert.deepEqual(
    profiles.map(p => [p.network, p.url]),
    [
      ['facebook', 'https://www.facebook.com/makemycoffee'],
      ['tiktok', 'https://www.tiktok.com/@makemycoffee'],
    ]
  )
})

test('social profiles: a Facebook profile.php link keeps its id', () => {
  // A Page without a vanity username is addressed only by ?id= — strip the
  // query and the link lands on Facebook's home page instead of ours.
  const [fb] = parseSocialProfiles({ SOCIAL_FACEBOOK_URL: 'https://www.facebook.com/profile.php?id=61594138372788' })
  assert.equal(fb?.url, 'https://www.facebook.com/profile.php?id=61594138372788')
})

test('social profiles: anything that is not a profile on that network is dropped', () => {
  const warn = console.warn
  console.warn = () => {}
  try {
    for (const bad of [
      'makemycoffee', // a handle, not a URL
      'http://www.instagram.com/makemycoffee', // not https
      'https://www.instagram.com/', // the network, not a profile
      'https://instagram.com.example.net/makemycoffee', // lookalike host
      'https://www.facebook.com/makemycoffee', // right URL, wrong variable
    ]) {
      assert.deepEqual(parseSocialProfiles({ SOCIAL_INSTAGRAM_URL: bad }), [], bad)
    }
  } finally {
    console.warn = warn
  }
})

test('social links come only from lib/social.ts', () => {
  // A handle typed into a page is one the env cannot remove.
  for (const file of [
    '../components/SocialLinks.tsx',
    '../components/Footer.tsx',
    '../app/(storefront)/about/page.tsx',
    '../app/(storefront)/layout.tsx',
  ]) {
    assert.doesNotMatch(code(file), /facebook\.com|instagram\.com|tiktok\.com/, `${file} hardcodes a social URL`)
  }
  assert.match(code('../components/SocialLinks.tsx'), /SOCIAL_PROFILES\.map/)
  for (const file of ['../components/Footer.tsx', '../app/(storefront)/about/page.tsx']) {
    assert.match(code(file), /<SocialLinks variant=/, `${file} should render the shared SocialLinks`)
  }
  assert.match(code('../app/(storefront)/layout.tsx'), /sameAs: SOCIAL_PROFILES\.map\(p => p\.url\)/)
})

test('/about is reachable: sitemap, footer and navbar', () => {
  assert.match(read('../app/sitemap.ts'), /\$\{base\}\/about/)
  assert.match(read('../components/Footer.tsx'), /'\/about'/)
  assert.match(read('../components/Navbar.tsx'), /href="\/about"/)
})
