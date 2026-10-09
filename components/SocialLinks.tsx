import { SOCIAL_PROFILES } from '@/lib/social'
import SocialIcon from './SocialIcon'

const focus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso-400'

const STYLES = {
  /** Round icon-only buttons, for espresso-900 backgrounds (footer, page heroes). */
  dark: {
    list: 'flex flex-wrap gap-3',
    link: `flex items-center justify-center w-10 h-10 rounded-full border border-espresso-700 text-espresso-300 hover:bg-espresso-400 hover:border-espresso-400 hover:text-espresso-900 transition-colors ${focus}`,
    icon: 'w-[18px] h-[18px]',
    showLabel: false,
  },
  /** Labelled pills, for white cards. */
  light: {
    list: 'flex flex-wrap gap-3',
    link: `inline-flex items-center gap-2.5 rounded-full bg-espresso-50 border border-espresso-200 px-5 py-2.5 text-sm font-semibold text-espresso-800 hover:bg-espresso-900 hover:border-espresso-900 hover:text-espresso-100 transition-colors ${focus}`,
    icon: 'w-5 h-5',
    showLabel: true,
  },
} as const

/**
 * The brand's social profiles as links — the one place they are rendered, so
 * the footer and /about cannot drift apart. Real accounts only, from env via
 * lib/social.ts; none configured renders nothing at all, not an empty list.
 */
export default function SocialLinks({ variant, className = '' }: { variant: keyof typeof STYLES; className?: string }) {
  if (SOCIAL_PROFILES.length === 0) return null
  const s = STYLES[variant]

  return (
    <ul className={`${s.list} ${className}`} aria-label="Follow us">
      {SOCIAL_PROFILES.map(p => (
        <li key={p.network}>
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className={s.link}
            {...(s.showLabel ? {} : { 'aria-label': p.label, title: p.label })}
          >
            <SocialIcon network={p.network} className={s.icon} />
            {s.showLabel && p.label}
          </a>
        </li>
      ))}
    </ul>
  )
}
