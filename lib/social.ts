// The brand's social profiles, for the footer, /about and the Organization
// JSON-LD's `sameAs`.
//
// From the environment, like lib/business.ts, and for a related reason: these
// have to be the real accounts, and none were known when this was written. A
// guessed handle is worse than none — it either 404s or, worse, points at
// somebody else's account under our name. Unset renders nothing.
//
// Each value must be a full https URL on that network's own domain. Anything
// else is dropped with a warning rather than rendered: a typo here becomes a
// broken link in the footer of every page, and a `sameAs` claiming a profile
// that isn't ours.
//
// The pages that read this are statically prerendered, so a change needs a
// redeploy to appear.

export type SocialNetwork = 'facebook' | 'instagram' | 'tiktok'

export interface SocialProfile {
  network: SocialNetwork
  label: string
  url: string
}

const NETWORKS: readonly { network: SocialNetwork; label: string; env: string; hosts: readonly string[] }[] = [
  { network: 'facebook', label: 'Facebook', env: 'SOCIAL_FACEBOOK_URL', hosts: ['facebook.com', 'www.facebook.com'] },
  { network: 'instagram', label: 'Instagram', env: 'SOCIAL_INSTAGRAM_URL', hosts: ['instagram.com', 'www.instagram.com'] },
  { network: 'tiktok', label: 'TikTok', env: 'SOCIAL_TIKTOK_URL', hosts: ['tiktok.com', 'www.tiktok.com'] },
]

/** The profile URL if it is one we will publish, otherwise null. */
function validProfileUrl(raw: string, hosts: readonly string[]): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname)) return null
  // A bare domain is the network's home page, not a profile.
  if (url.pathname.replace(/\/+$/, '') === '') return null
  return url.toString()
}

/** Pure, so it can be tested without touching process.env. */
export function parseSocialProfiles(env: Record<string, string | undefined>): SocialProfile[] {
  const profiles: SocialProfile[] = []
  for (const { network, label, env: name, hosts } of NETWORKS) {
    const raw = env[name]?.trim()
    if (!raw) continue
    const url = validProfileUrl(raw, hosts)
    if (url) profiles.push({ network, label, url })
    else console.warn(`[social] ${name} is not an https URL on ${hosts[0]} — not rendering it`)
  }
  return profiles
}

export const SOCIAL_PROFILES = parseSocialProfiles(process.env)
