export interface Product {
  id: string
  name: string
  shots: number
  volume: string
  price: number
  description: string
  badge?: string
}

export const products: Product[] = [
  {
    id: '4-shot',
    name: 'Aconchego Starter',
    shots: 4,
    volume: '120ml',
    price: 299,
    description:
      'Perfect for the curious soul. Four rich 30ml espresso shots of our Aconchego blend, ready to transform into your favorite drink.',
  },
  {
    id: '7-shot',
    name: 'Aconchego Classic',
    shots: 7,
    volume: '210ml',
    price: 449,
    description:
      'Our most popular size. Seven shots — exactly one per day for a full week. Perfect for the daily ritual drinker.',
    badge: 'Most Popular',
  },
  {
    id: '10-shot',
    name: 'Aconchego Reserve',
    shots: 10,
    volume: '300ml',
    price: 599,
    description:
      'For those who run on more than one shot a day. Ten shots to fuel your week — morning, afternoon, whenever you need it.',
    badge: 'Best Value',
  },
]

// Largest quantity accepted for a single line. Not a stock rule (there is no
// inventory tracking) — just a sanity bound so a malformed or hostile payload
// can't book a 10-million-bottle order.
export const MAX_LINE_QUANTITY = 99

// The cart snapshot stored on an order, priced from this catalog.
export interface PricedLine {
  id: string
  name: string
  shots: number
  price: number
  quantity: number
}

// Re-prices a posted cart against the catalog above, which is the only
// authority on what anything costs (D8). The browser sends ids and quantities;
// every peso figure on the order is derived here, never read from the request.
//
// This matters beyond tidiness: the voucher rules (minimum spend, percentage
// off) are all computed from the subtotal, so a client-supplied subtotal would
// make them trivially bypassable.
//
// Returns null if the cart is empty, names a product that doesn't exist, or
// carries a quantity that isn't a sane whole number — all of which mean the
// payload can't be priced and the order should be rejected outright.
export function priceOrderItems(input: unknown): { items: PricedLine[]; subtotal: number } | null {
  if (!Array.isArray(input) || input.length === 0) return null

  const items: PricedLine[] = []
  for (const raw of input) {
    const product = products.find(p => p.id === (raw as { id?: unknown })?.id)
    if (!product) return null

    const quantity = Number((raw as { quantity?: unknown })?.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) return null

    items.push({
      id: product.id,
      name: product.name,
      shots: product.shots,
      price: product.price,
      quantity,
    })
  }

  const subtotal = items.reduce((sum, line) => sum + line.price * line.quantity, 0)
  return { items, subtotal }
}
