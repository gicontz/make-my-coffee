import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTACT_EMAIL, LEGAL_NAME, PRIVACY_UPDATED } from '@/lib/business'

export const metadata: Metadata = {
  title: 'Privacy Policy — Make My Coffee',
  description: 'What Make My Coffee collects, why, who else sees it, and how to have it removed.',
}

const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-espresso-100">
      <h2 className="text-espresso-900 font-bold text-xl mb-4" style={serif}>{title}</h2>
      <div className="space-y-3 text-sm text-espresso-600 leading-relaxed">{children}</div>
    </section>
  )
}

/**
 * Written to match what the code actually does, not from a template — the
 * collection list mirrors the `orders` and `chat_*` tables, and the processor
 * list is every external host the app talks to. If either changes, this page
 * is wrong until it is updated.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-espresso-50">
      <div className="bg-espresso-900 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-espresso-50" style={serif}>Privacy Policy</h1>
          <p className="text-espresso-300 mt-3">Last updated {PRIVACY_UPDATED}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <Section title="The short version">
          <p>
            We collect what we need to deliver coffee to you and nothing else. We do not run advertising trackers,
            we do not use analytics, and we have never sold anyone&apos;s details. If you want your information
            removed, email us and we will remove it.
          </p>
        </Section>

        <Section title="What we collect">
          <p><strong className="text-espresso-800">When you place an order:</strong> your name, email address, phone
          number, delivery address (street, barangay, city, province, postal code), any notes you add, the location
          pin you place on the map, what you ordered, the total, your chosen delivery time windows, and which
          payment method you picked.</p>

          <p><strong className="text-espresso-800">When you use a voucher:</strong> your email address, so codes
          limited to one use per customer can be enforced.</p>

          <p><strong className="text-espresso-800">When you use the chat:</strong> the messages you send, and a
          random identifier stored in a cookie so the conversation is still there if you reload the page. That
          identifier is not linked to your name or email unless you give them to us in the chat.</p>

          <p><strong className="text-espresso-800">What we do not collect:</strong> we do not store card or wallet
          credentials — QR payments happen entirely inside your own banking app, and we only ever see the receipt
          you choose to send us. We do not use advertising or analytics trackers of any kind.</p>
        </Section>

        <Section title="Why we hold it">
          <p>To take, price, deliver and confirm your order; to send you order confirmations and delivery updates;
          to answer your questions; to prevent voucher abuse; and to keep ordinary business records of sales.</p>
          <p>We do not send marketing email. Every email we send relates to an order you actually placed.</p>
        </Section>

        <Section title="Who else sees it">
          <p>Only the services we need to run the shop. Each one gets the minimum for its job:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-espresso-800">Vercel</strong> — hosts the website.</li>
            <li><strong className="text-espresso-800">Neon</strong> — hosts the database where orders are stored.</li>
            <li><strong className="text-espresso-800">Lalamove</strong> — our delivery partner. Receives your delivery
              address and map pin so a rider can find you, and to price the delivery.</li>
            <li><strong className="text-espresso-800">OpenStreetMap (Nominatim)</strong> — turns the address you type
              into map coordinates. Receives the address text only.</li>
            <li><strong className="text-espresso-800">Resend and Google (Gmail)</strong> — deliver our order emails.
              Receive your email address and the contents of that email.</li>
            <li><strong className="text-espresso-800">Anthropic</strong> — powers the chat assistant. Receives the
              text of chat messages when the assistant answers them. It is not used to train their models.</li>
            <li><strong className="text-espresso-800">Meta</strong> — only if you choose to message our Facebook Page.
              Anything you send there is handled under Meta&apos;s own policy, not this one.</li>
          </ul>
          <p>Nobody on this list is permitted to use your details for their own marketing, and we have never sold or
          rented personal information to anyone.</p>
        </Section>

        <Section title="Cookies">
          <p>Three, all functional — none for advertising:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><code className="text-espresso-800">mmc-chat</code> — keeps your chat conversation attached to your
              browser. Expires after a year.</li>
            <li><code className="text-espresso-800">mmc_admin</code> — only ever set for shop staff signing in to the
              back office. Never set for customers.</li>
            <li>Your <strong className="text-espresso-800">cart</strong> is kept in your browser&apos;s own storage,
              not on our servers, until you place the order.</li>
          </ul>
        </Section>

        <Section title="How long we keep it">
          <p>Order records are kept as long as we need them for business and tax records. Chat conversations are kept
          so we can follow up on what you asked. Ask us to delete either and we will, except where we are required to
          keep a record of a completed sale.</p>
        </Section>

        <Section title="Your rights">
          <p>Under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) you may ask us to show you what
          we hold about you, correct anything wrong, delete or block it, object to how we use it, or give you a copy
          in a portable form. You can also complain to the National Privacy Commission.</p>
          <p>
            To exercise any of these, email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-espresso-900 font-semibold underline underline-offset-4 break-all">
              {CONTACT_EMAIL}
            </a>
            . We will respond as quickly as we can, and we will not charge you for it.
          </p>
        </Section>

        <Section title="Security, honestly stated">
          <p>Data is transmitted over encrypted connections and the database is not publicly reachable. Access to
          order details is limited to shop staff. In the chat, looking up an order requires both the order number and
          the email address it was placed with, precisely so that knowing a number alone reveals nothing.</p>
          <p>We are a small shop, not a bank. We have taken sensible precautions, but no website can promise perfect
          security, and we would rather say so than imply otherwise.</p>
        </Section>

        <Section title="Changes">
          <p>If we change how we handle your information, we will update this page and the date at the top. This
          policy was last changed on {PRIVACY_UPDATED}.</p>
        </Section>

        <p className="text-espresso-500 text-sm">
          Questions about any of this? <Link href="/contact" className="font-semibold underline underline-offset-4">Contact us</Link>.
          {' '}This policy is offered by {LEGAL_NAME}.
        </p>
      </div>
    </div>
  )
}
