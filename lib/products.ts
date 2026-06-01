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
