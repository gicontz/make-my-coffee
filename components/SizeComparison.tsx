import Image from 'next/image'
import { products } from '@/lib/products'
import {
  SIZE_COMPARISON_ALT,
  SIZE_COMPARISON_IMAGE,
  SIZE_COMPARISON_X,
} from '@/app/(storefront)/shop/images'

/**
 * The three bottles side by side, captioned under each base (#40). Size is
 * the decision a shopper is making, and three separate cards can't show it.
 *
 * `current` highlights one bottle's caption on its own product page.
 */
export default function SizeComparison({ current }: { current?: string }) {
  return (
    <figure className="w-full max-w-md mx-auto">
      <Image
        src={SIZE_COMPARISON_IMAGE}
        alt={SIZE_COMPARISON_ALT}
        sizes="(min-width: 768px) 448px, 100vw"
        className="w-full h-auto"
      />
      <figcaption className="relative h-12 mt-1">
        {products.map((p, i) => {
          const active = p.id === current
          return (
            <div
              key={p.id}
              className="absolute top-0 -translate-x-1/2 text-center whitespace-nowrap"
              style={{ left: SIZE_COMPARISON_X[i] }}
            >
              <div className={`leading-tight ${active ? 'text-espresso-400' : 'text-espresso-900'}`}>
                <span className="font-bold text-lg" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                  {p.shots}
                </span>{' '}
                <span className="text-[10px] font-semibold uppercase tracking-wider">shots</span>
              </div>
              <div className={`text-xs ${active ? 'text-espresso-700 font-semibold' : 'text-espresso-500'}`}>
                {p.volume}
              </div>
            </div>
          )
        })}
      </figcaption>
    </figure>
  )
}
