// The methods an admin can record when marking an order paid.
//
// 'cod' is also the value every order is inserted with (app/api/orders/route.ts)
// — it's a placeholder meaning "no online payment happened at checkout", not a
// claim that cash actually changed hands yet. There's no online payment gateway
// live (PayPal is still blocked on sandbox creds), so every payment today is
// collected out-of-band — on delivery, or once the admin reaches the customer
// — and can turn out to be any of these, which is why "Mark Paid" asks rather
// than assuming COD. If/when an online gateway goes live, its webhook can set
// payment_method itself and this list gains e.g. 'paypal'.
export const PAYMENT_METHODS = [
  { value: 'cod',            label: 'Cash on Delivery' },
  { value: 'gcash',          label: 'GCash' },
  { value: 'maya',           label: 'Maya' },
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
