// TRACKERS in lib/analytics.ts reads its ids from the environment when the
// module loads. Import this first, before anything that imports analytics —
// ES modules evaluate in import order, so these are set by then.
process.env.NEXT_PUBLIC_GA4_ID = 'G-TEST'
process.env.NEXT_PUBLIC_META_PIXEL_ID = '1234'
process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID = 'TT-TEST'
