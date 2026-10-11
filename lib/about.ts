// The parts of /about that only the people behind the business can supply.
//
// ⚠️ Never draft these. A founder story on a food brand is a trust claim — who
// makes the coffee, and why they can be trusted to — and an invented one
// cannot be walked back once a customer has relied on it. Until the real text
// is supplied, the section is left off the page entirely rather than filled
// with something plausible.
//
// A code constant rather than an env var, unlike lib/business.ts: this is
// prose that should be reviewed in the commit that publishes it, and nothing
// in it should be private. Keep anything that is (a home address, a personal
// number) out of it — this repository is public.

/**
 * Who makes the coffee and why, one string per paragraph. `null` hides the
 * section; set it only to words the founders have written or approved.
 */
export const FOUNDER_STORY: readonly string[] | null = null

/** Optional sign-off under the story — a name, or names, as the founders want to be credited. */
export const FOUNDER_SIGNOFF: string | null = null
