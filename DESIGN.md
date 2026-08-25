---
name: Make My Coffee
description: Premium-but-accessible storefront for bottled Aconchego espresso shots, built for PH home-cafe DIYers.
colors:
  espresso-noir: "#1C0A00"
  espresso-bean: "#2C1810"
  cacao: "#5C3317"
  amber: "#8B5E0A"
  caramel-gold-deep: "#A86E08"
  caramel-gold: "#C8860A"
  honey: "#D4A96A"
  sand: "#E8C9A0"
  cream: "#F5E6D3"
  porcelain: "#FBF8F5"
  success: "#16A34A"
  danger: "#B91C1C"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(3rem, 6vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(1.75rem, 4vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "normal"
  title:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "Work Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  label:
    fontFamily: "Work Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  sm: "12px"
  md: "16px"
  lg: "24px"
  full: "9999px"
spacing:
  section: "96px"
  card: "32px"
  field: "16px"
  inline: "8px"
components:
  button-primary:
    backgroundColor: "{colors.caramel-gold}"
    textColor: "{colors.espresso-noir}"
    rounded: "{rounded.full}"
    padding: "16px 32px"
  button-primary-hover:
    backgroundColor: "{colors.caramel-gold-deep}"
    textColor: "{colors.espresso-noir}"
  button-dark:
    backgroundColor: "{colors.espresso-noir}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.full}"
    padding: "16px 32px"
  button-dark-hover:
    backgroundColor: "{colors.cacao}"
    textColor: "{colors.porcelain}"
  input:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.espresso-noir}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  input-focus:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.espresso-noir}"
  card:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.espresso-noir}"
    rounded: "{rounded.md}"
    padding: "32px"
  badge:
    backgroundColor: "{colors.caramel-gold}"
    textColor: "{colors.espresso-noir}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  chip:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.cacao}"
    rounded: "{rounded.full}"
    padding: "6px 16px"
---

# Design System: Make My Coffee

## 1. Overview

**Creative North Star: "The Warm Roastery"**

The interface should feel like stepping into a small, well-run roastery: deep roasted-espresso surfaces, caramel-gold light catching the edges, and pale cream paper for the working areas. The mood is calm and confident, never loud. The product is economical, but nothing here is allowed to read as cheap; affordability is communicated through clarity and restraint, not through promotional noise. Warmth comes from the palette's roasted-brown depth and the serif display voice, not from clutter or decoration.

The system runs on a single dominant axis: **near-black espresso for atmosphere, caramel-gold as the rare spark.** Heroes, navigation, footers, and section breaks sink into `espresso-noir`. Working surfaces (product cards, forms, summaries) sit on white or `porcelain` cream. Gold is the one bright note, and it earns its brightness by being scarce. The intended direction is **crisp and refined**: hairline borders, restrained shadow, and tighter geometry than a soft consumer template, so an inexpensive product carries a considered, premium feeling.

This system explicitly rejects the **loud discount / sari-sari look** (neon, stacked promo banners, "SALE!!!" energy, crowded layouts), the **interchangeable Shopify-template DTC** look (stock hero, endless identical icon-heading-text card grids, no point of view), and **cold corporate / tech-SaaS sterility** (this is a warm food-and-drink brand, not a B2B dashboard).

**Key Characteristics:**
- Dark espresso atmosphere; cream working surfaces; gold as a scarce accent.
- Playfair Display serif for every heading; Work Sans for everything else.
- Mobile-first and thumb-first: the core customer is on a phone, paying cash on delivery.
- Crisp and refined over soft and decorative; restraint is the premium signal.
- WCAG 2.1 AA contrast is a hard floor, not a nice-to-have.

## 2. Colors

A roasted-coffee ramp from near-black bean to pale cream, lit by a single caramel-gold accent. Status colors (green, red) are the only hues outside the brown-gold family and appear only for system feedback.

### Primary
- **Caramel Gold** (`#C8860A`, espresso-400): The single brand accent. Primary CTA fills, active states, the brand mark, display-heading highlights, badges, and small accents on dark surfaces. Its scarcity is the point: it should never become a default text color.
- **Caramel Gold Deep** (`#A86E08`, espresso-500): The hover/pressed partner for Caramel Gold on fills.

### Neutral (the roasted ramp)
- **Espresso Noir** (`#1C0A00`, espresso-900): The atmosphere color. Hero, navbar, footer, admin sidebar, section breaks, and the primary "dark button" fill. Also the text color that sits on gold and on cream.
- **Espresso Bean** (`#2C1810`, espresso-800): Surfaces and hover states layered on top of Espresso Noir (active nav item, hero badge pill, dividers on dark).
- **Cacao** (`#5C3317`, espresso-700): Mid-brown. Body text on light surfaces when an emphasized warm tone is wanted; "dark button" hover.
- **Amber** (`#8B5E0A`, espresso-600): Deep gold-brown for muted detail on light surfaces and quiet text on dark.
- **Honey** (`#D4A96A`, espresso-300): Light caramel. Decorative dividers and connector dots only. **Not a text color on white** (fails AA).
- **Sand** (`#E8C9A0`, espresso-200): The default border/divider on light surfaces; chip borders.
- **Cream** (`#F5E6D3`, espresso-100): Light tinted surface behind product imagery, chip fills, low-emphasis panels.
- **Porcelain** (`#FAF6F1`, espresso-50): The page background on light pages, and the light text color (`espresso-50`) used on dark surfaces.

### Status (system feedback only)
- **Success** (`#16A34A`, green-600): "Free delivery" nudge, order-placed confirmation, paid status. Always paired with text or an icon, never color alone.
- **Danger** (`#B91C1C`, red-700): Form/order errors, cancelled status. Always paired with text.

### Named Rules
**The One Spark Rule.** Caramel Gold is the only bright accent and it appears on a small fraction of any screen: CTAs, the brand mark, badges, and large display highlights. The moment gold is carrying running text or filling large areas, it has stopped being the spark and the design has gone discount.

**The Gold-on-Dark Rule.** Caramel Gold is for fills, large display accents, and text **on dark espresso surfaces**. It is never small body text on white or cream: at small sizes on a light background it falls below AA. For small text on light, step up to Cacao (`#5C3317`) or darker.

## 3. Typography

**Display Font:** Playfair Display (with Georgia, serif fallback)
**Body Font:** Work Sans (with system-ui, sans-serif fallback)

**Character:** A high-contrast serif (Playfair) paired with a neutral humanist sans (Work Sans) on a clean contrast axis: every heading is the serif, everything else is Work Sans. The serif carries the warmth and craft; Work Sans keeps prices, forms, and labels legible and modern. Two families only; do not introduce a third.

### Hierarchy
- **Display** (Playfair, 700, `clamp(3rem, 6vw, 4.5rem)`, line-height 1.08): Hero headline only. One per page. Max ceiling ~4.5rem; do not exceed.
- **Headline** (Playfair, 700, `clamp(1.75rem, 4vw, 2.25rem)`, line-height 1.15): Section titles ("Choose Your Bottle", "Place Your Order").
- **Title** (Playfair, 700, 1.25rem, line-height 1.25): Card and product names, modal titles, form-section headings.
- **Body** (Work Sans, 400, 1rem, line-height 1.625): Paragraph copy. Cap measure at 65–75ch. For emphasized lead paragraphs, step weight or size, not color.
- **Label** (Work Sans, 600, 0.75rem, letter-spacing 0.08em, uppercase): Field labels, status pills, the brand tagline ("Espresso Shots"). Reserve uppercase for labels of ≤4 words.

### Named Rules
**The Serif-Headings Rule.** Every heading is Playfair Display, applied inline as `style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}` (Tailwind `font-serif` is intentionally not configured). Body and UI text is always Work Sans. There is no third typeface.

**The Sparing-Eyebrow Rule.** The small uppercase tracked label is a real part of the system, but it is **not** an automatic eyebrow above every section. Today the storefront repeats it ("The Blend Story", "Simple Process", "Get Creative") on nearly every section; that reads as AI scaffolding and works against the premium brief. Use the label for genuine labels (field names, status, the brand tagline), not as a reflexive section kicker.

## 4. Elevation

A hybrid system: light working surfaces are **flat with hairline borders**, and shadow is reserved for things that genuinely float (overlays, the primary CTA, hover feedback). Depth on dark surfaces is conveyed tonally, by layering `espresso-bean` over `espresso-noir`, not with shadow. The refined direction means keeping resting shadows minimal; a card at rest leans on its `sand`/`cream` border, not a drop shadow.

### Shadow Vocabulary
- **Card resting** (`box-shadow: 0 1px 2px rgba(0,0,0,0.05)`, Tailwind `shadow-sm`): The quiet lift under form cards and the order summary. Often paired with a border rather than used alone.
- **Hover lift** (`box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1)`, Tailwind `shadow-lg`): Product cards and CTAs on hover; signals interactivity.
- **CTA glow** (`box-shadow: 0 10px 15px -3px rgba(200,134,10,0.2)`, `shadow-lg shadow-espresso-400/20`): The warm gold halo under the hero primary button. Use only under gold CTAs on dark.
- **Overlay** (`box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25)`, Tailwind `shadow-2xl`): Modals and floating feature cards that sit above the page.

### Named Rules
**The Border-First Rule.** On light surfaces, define a card or field by its `sand` (`#E8C9A0`) or `cream` (`#F5E6D3`) border first; add `shadow-sm` only for a hint of lift. Heavy resting shadows read as a 2014 app and undercut the refined direction.

## 5. Components

The intended feel is **crisp and refined**. The current build leans soft (pill buttons, large 16–24px radii); when extending it, favor the tighter end of the radius scale and hairline borders over rounded, shadow-heavy surfaces.

### Buttons
- **Shape:** Fully rounded pills (`rounded-full`) at present, padding `16px 32px` (`px-8 py-4`).
- **Primary (gold):** `caramel-gold` (`#C8860A`) fill, `espresso-noir` text, bold. Hover → `caramel-gold-deep` (`#A86E08`). The headline CTA on dark also carries the gold CTA glow. This is the highest-emphasis action (Shop Now, Add to Cart).
- **Dark:** `espresso-noir` fill, `porcelain` text, bold. Hover → `cacao` (`#5C3317`). Used for primary actions on light pages (View Details, Place Order, Back to Home).
- **Ghost:** Transparent with a 2px border (`espresso-600`), light text; hover brightens border to `caramel-gold` and text toward `porcelain`. Secondary action on dark (How It Works).
- **States:** Color transitions only (`transition-colors`); the success confirmation swaps to `success` green with a check. Disabled drops to 60% opacity with a spinner.

### Chips / Tags
- **Style:** `cream` (`#F5E6D3`) fill, `cacao` (`#5C3317`) text, `sand` (`#E8C9A0`) hairline border, fully rounded, small. Used for tasting notes (Dark Chocolate, Brown Sugar, Smooth Finish).
- **State:** Static/informational only; not interactive filters in the current storefront.

### Cards / Containers
- **Corner Style:** `md` (16px, `rounded-2xl`) for product and form cards; `lg` (24px, `rounded-3xl`) for modals and the feature/bean-story card.
- **Background:** White for forms and the order summary; `porcelain`/`cream` for product cards and image wells.
- **Shadow Strategy:** Per Elevation: hairline `sand`/`cream` border + `shadow-sm` at rest; `shadow-lg` and border brighten to `honey` on hover.
- **Border:** `cream` (`#F5E6D3`) or `sand` (`#E8C9A0`), 1px. Never a thick colored side-stripe.
- **Internal Padding:** 24–32px (`p-6` to `p-8`).

### Inputs / Fields
- **Style:** White fill, 1px `sand` (`#E8C9A0`) border, `sm` radius (12px, `rounded-xl`), padding `12px 16px`, Work Sans at 0.875rem. Labels are the uppercase Label style above the field.
- **Focus:** Border shifts to `caramel-gold` (`#C8860A`) plus a soft 2px gold ring at 20% opacity (`focus:ring-espresso-400/20`). No glow beyond the ring.
- **Placeholder:** Currently `honey` (`espresso-300`), which fails AA on white. **Darken placeholder text to at least `amber`/`cacao`** so it meets 4.5:1.
- **Error:** `danger` text on a `red-50` panel with a `red-200` border.

### Navigation
- **Storefront:** Fixed top bar, `espresso-noir` at 95% with backdrop blur and an `espresso-bean` bottom border. Links are `espresso-200` → hover `espresso-300`, Work Sans 0.875rem medium. Cart icon carries a gold count bubble. Mobile collapses to a hamburger panel.
- **Admin:** Fixed left sidebar (224px), solid `espresso-noir`. Active item = `espresso-bean` fill with `porcelain` text and a gold icon; inactive = muted with a hover tint. Logout sits pinned at the bottom.

### Signature Component: Hero Bottle Labels
Interactive labels pinned over the hero bottle image, each anchored to a bottle by a connector dot and hairline. On hover/tap they expand from a compact shot-count pill into a translucent dark card (blurred `espresso-noir`, gold-tinted border and shadow) showing name, price, and a "tap to add" affordance, then open the add-to-cart modal. This is the storefront's most distinctive pattern; preserve its tactile, exploratory feel and its reliance on tonal dark layering rather than bright fills.

## 6. Do's and Don'ts

### Do:
- **Do** keep Caramel Gold (`#C8860A`) scarce: CTAs, the brand mark, badges, and large display highlights only (The One Spark Rule).
- **Do** use gold for text only on dark espresso surfaces; on light, use Cacao (`#5C3317`) or darker for small text (The Gold-on-Dark Rule).
- **Do** set every heading in Playfair Display and everything else in Work Sans; never add a third typeface (The Serif-Headings Rule).
- **Do** define light-surface cards and fields by a hairline `sand`/`cream` border first, with `shadow-sm` for a hint of lift (The Border-First Rule).
- **Do** hold body text and placeholders to WCAG AA (≥4.5:1); darken the current `espresso-300` placeholder.
- **Do** design mobile-first with ≥44px tap targets and a `prefers-reduced-motion` fallback for every animation.
- **Do** lead product sections with the made drinks and the mixing idea, not just the bottle (per PRODUCT.md: show the drink, not just the bottle).

### Don't:
- **Don't** reach for the loud discount / sari-sari look: no neon, no stacked promo banners, no "SALE!!!", no crowded screaming layouts. Affordability shows through clarity, never noise.
- **Don't** build the interchangeable Shopify-template DTC page: stock hero plus endless identical icon-heading-text card grids with no point of view.
- **Don't** drift toward cold corporate / tech-SaaS sterility; this is a warm food-and-drink brand.
- **Don't** put a small uppercase tracked eyebrow above every section, and don't use numbered section markers (01 / 02 / 03) as default scaffolding. Numbers earn their place only in a true sequence (the checkout steps, a real 3-step process).
- **Don't** use Caramel Gold or Honey as small running text on white/cream (fails AA).
- **Don't** use emoji as a brand visual (e.g. the 🫘 in the blend-story card); use real imagery or a crafted SVG mark.
- **Don't** apply colored side-stripe borders (`border-left`/`border-right` > 1px) or gradient text; both are banned.
