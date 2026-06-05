# Product

## Register

brand

> Default register is **brand** — the customer storefront (landing, shop, cart, checkout) is the primary surface and the design carries the brand. The admin backoffice (`/admin/*`: orders, dashboard, login) is a secondary **product** surface; override to `product` when working there.

## Users

**Primary: PH home-cafe DIYers.** Budget-conscious Filipino coffee lovers in Pasig and greater Metro Manila who want cafe-quality drinks at home without cafe prices. They buy bottled espresso shots (4 / 7 / 10) and mix their own lattes, iced drinks, and tonics. They shop on their phones, pay cash on delivery, and value getting more coffee for less money. They are not coffee snobs; they want the result (a great drink, made their way) more than the ritual or the pedigree.

**Secondary: the shop operator (admin).** A single operator running the business from the `/admin` backoffice — checking new orders, marking them approved/shipped/delivered, and toggling payment status on COD delivery. Their job is fast, unambiguous order triage on whatever device is handy.

## Product Purpose

Make My Coffee sells **Aconchego**, a single house blend of Cambodian and Indonesian beans, as pure 30ml espresso shots in 4-, 7-, and 10-shot bottles (₱299 / ₱449 / ₱599). The premise is economical, DIY espresso: instead of paying cafe prices per drink, you buy concentrated shots and build your own drinks at home. Success looks like a first-time visitor understanding the "buy shots, mix your own" idea within seconds, trusting the brand enough to place a COD order, and coming back to reorder.

## Brand Personality

**Premium, crafted, refined — but accessible.** The core tension to design around: the *product* is economical, but the *brand* should never feel cheap. "Aconchego" is Portuguese for warmth and the feeling of being welcomed home; the voice is calm, confident, and a little warm, not loud or salesy. It treats an affordable product with the care usually reserved for expensive ones. Tasting notes (dark chocolate, brown sugar, smooth finish) and the blend story matter; gimmicks and hype do not.

## Anti-references

- **Loud discount / sari-sari clutter (explicit).** No neon, no stacked promo banners, no "SALE!!!" energy, no crowded screaming layouts. Affordability is communicated through clarity and confidence, never through visual noise that reads as cheap.
- Generic Shopify-template DTC: interchangeable stock hero, endless identical icon-heading-text card grids, no point of view.
- Cold corporate / tech-SaaS sterility: this is a warm food-and-drink brand, not a B2B dashboard.

## Design Principles

1. **Make affordable feel elevated.** Every choice should let a budget product carry a premium feeling. When a decision could read as "cheap" or as "refined," choose refined. Restraint over decoration.
2. **Show the drink, not just the bottle.** The payoff is the cup the customer builds. Lead with the made drinks and the mixing idea; the product is a means to that result.
3. **One blend, told well.** There is a single blend (Aconchego). Depth comes from telling its story (origin, tasting notes, the meaning of the name) with care, not from inventing fake variety.
4. **Earn trust for a cash transaction.** Buyers pay COD, sight unseen. Clarity on price, shipping, and what arrives builds the confidence to order. No dark patterns, no fake urgency.
5. **Mobile-first, thumb-first.** The core customer is on a phone. Layouts, tap targets, and checkout are designed for one-handed mobile use before desktop.

## Accessibility & Inclusion

- Target **WCAG 2.1 AA**: body text ≥4.5:1 contrast, large text ≥3:1, visible focus states, full keyboard operability for the shop and checkout flows.
- **Mobile-first** is an accessibility concern here, not just layout: real tap-target sizes (≥44px), legible base font sizes, and forms that work on small screens.
- Honor `prefers-reduced-motion` for every animation with a crossfade or instant fallback.
- Don't rely on color alone to convey status (order/payment states in admin, badges on products); pair with text or icon.

> Accessibility targets above are sensible defaults for a public PH ecommerce storefront, not a stated legal requirement. Revise if a specific compliance level is mandated.
