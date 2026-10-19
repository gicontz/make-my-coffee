/**
 * A read-only row of five stars. The label carries the number, so a screen
 * reader hears "4 out of 5 stars" rather than five unlabeled glyphs.
 *
 * Whole stars only, rounded: a product page's average is printed beside it as
 * a number, so the stars only need to be roughly right at a glance.
 */
export default function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  const filled = Math.round(rating)
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <svg
          key={n}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={n <= filled ? 'text-espresso-400' : 'text-espresso-200'}
          fill="currentColor"
        >
          <path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5z" />
        </svg>
      ))}
    </span>
  )
}
