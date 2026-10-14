import { NextRequest, NextResponse } from 'next/server'
import { subscribe } from '@/lib/subscriberStore'
import { isSignupSource, isValidEmail } from '@/lib/subscribe'

// The email signup form (#39). Public by nature, so it is bounded three ways:
// a honeypot for naive bots, a site-wide daily ceiling on new addresses
// (MAX_SIGNUPS_PER_DAY), and at most one welcome email per address, ever —
// signing a stranger up twice sends them nothing the second time.
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email, source, consent, website } = await request.json()

    // Hidden field a person never sees. Anything in it is a bot; tell it
    // everything went fine and do nothing.
    if (typeof website === 'string' && website.trim()) {
      return NextResponse.json({ ok: true })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }
    if (!isSignupSource(source)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    // The form shows SIGNUP_CONSENT beside its button and sends `consent: true`
    // with it. A caller that didn't show the wording has no consent to record.
    if (consent !== true) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const outcome = await subscribe(email, source)
    if (outcome === 'busy') {
      return NextResponse.json(
        { error: 'We’ve had a lot of signups today — please try again tomorrow.' },
        { status: 429 }
      )
    }

    // 'subscribed' and 'existing' answer identically, so this form can't be
    // used to learn whether an address is already on the list.
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/subscribe error:', err)
    return NextResponse.json({ error: 'Couldn’t sign you up just now. Please try again.' }, { status: 500 })
  }
}
