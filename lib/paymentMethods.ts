// How an order gets paid — the customer's choice at checkout, and the admin's
// record of what money actually turned up.
//
// Two lists, because they answer different questions:
//
//   CHECKOUT_PAYMENT_METHODS — what the customer can pick on /order.
//   PAYMENT_METHODS          — what the admin can record on "Mark Paid".
//
// The admin list is the wider one. A customer who picked GCash can still hand
// over cash at the door, and a bank transfer can be arranged off-site, so the
// admin must be able to record something the customer never selected. Neither
// list implies money moved: `payment_status` is 'unpaid' on every insert, for
// every method, and only "Mark Paid" ever changes that.
//
// None of the QR methods are verified. There's no merchant API for GCash, Maya
// or GoTyme on this account, so checkout can only *display* a QR code and take
// the customer's word for it — see memory/decision.md D13. If a real gateway
// ever goes live, its webhook can set payment_method itself.
export const PAYMENT_METHODS = [
  { value: 'cod',            label: 'Cash on Delivery' },
  { value: 'gcash',          label: 'GCash' },
  { value: 'maya',           label: 'Maya' },
  { value: 'gotyme',         label: 'GoTyme Bank' },
  { value: 'bank_transfer',  label: 'Bank Transfer' },
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value']

const VALID = new Set<string>(PAYMENT_METHODS.map(m => m.value))

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && VALID.has(value)
}

export function paymentMethodLabel(value: string): string {
  return PAYMENT_METHODS.find(m => m.value === value)?.label ?? value
}

// ── Checkout ──────────────────────────────────────────────────────────────

// 'bank_transfer' is deliberately absent: it's an admin bookkeeping category
// for money settled off-site, not something we can show a customer a QR for.
export const CHECKOUT_PAYMENT_METHODS = ['cod', 'gcash', 'maya', 'gotyme'] as const

export type CheckoutPaymentMethod = (typeof CHECKOUT_PAYMENT_METHODS)[number]

export const DEFAULT_PAYMENT_METHOD: CheckoutPaymentMethod = 'cod'

const CHECKOUT_VALID = new Set<string>(CHECKOUT_PAYMENT_METHODS)

export function isCheckoutPaymentMethod(value: unknown): value is CheckoutPaymentMethod {
  return typeof value === 'string' && CHECKOUT_VALID.has(value)
}

// ── QR accounts ───────────────────────────────────────────────────────────

export interface QrAccount {
  method: Exclude<CheckoutPaymentMethod, 'cod'>
  /** Wallet/bank name, as the customer knows it. */
  label: string
  /** Account holder, exactly as the wallet prints it on the QR. */
  accountName: string
  /** Label for `accountRef` — "Mobile No.", "Account No.". */
  accountRefLabel: string
  /**
   * The account identifier, masked exactly as the wallet prints it on the
   * share-QR. It's a *confirmation* check — "the name and last digits match
   * what my app is showing" — not something to type, so the QR stays the only
   * way to address the payment and the image is not decorative.
   *
   * The unmasked values do exist: they're encoded in the QR payloads
   * themselves (EMVCo — decode one and the account number is in plain text).
   * Showing them in full would give customers a typable fallback for when a
   * scan won't work. Left masked deliberately, because publishing a named
   * individual's mobile number on a public page is the account holder's call
   * to make, not a default. See app/assets/qr/README.md to recover them.
   */
  accountRef: string
  /** Public path under public/qr — a stable URL, because the email links it. */
  image: string
  width: number
  height: number
  /** Where the customer scans it from. */
  scanHint: string
}

// Cropped/optimised from the account holder's own share-QR screenshots; the
// unedited exports live in app/assets/qr (see that folder's README).
export const QR_ACCOUNTS: QrAccount[] = [
  {
    method: 'gcash',
    label: 'GCash',
    accountName: 'GL**A C.',
    accountRefLabel: 'Mobile No.',
    accountRef: '0976 093 ••••',
    image: '/qr/gcash.jpg',
    width: 800,
    height: 1028,
    scanHint: 'Scan in GCash → Send Money → Scan QR, or save the image and upload it there.',
  },
  {
    method: 'maya',
    label: 'Maya',
    accountName: 'ROMEL MACINAS',
    accountRefLabel: 'Mobile No.',
    accountRef: '+63 ••• ••• 7880',
    image: '/qr/maya.jpg',
    width: 800,
    height: 966,
    scanHint: 'Scan in Maya → Pay → Scan QR, or save the image and upload it there.',
  },
  {
    method: 'gotyme',
    label: 'GoTyme Bank',
    accountName: 'GLEIA CONTILLO',
    accountRefLabel: 'Account No.',
    accountRef: '••••••• 6905',
    image: '/qr/gotyme.jpg',
    width: 800,
    height: 987,
    scanHint: 'Scan from any InstaPay-enabled banking app — GoTyme, or your own bank.',
  },
]

export function qrAccountFor(method: string): QrAccount | null {
  return QR_ACCOUNTS.find(a => a.method === method) ?? null
}
