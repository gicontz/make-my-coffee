# Brand assets

Marketing and identity assets for Make My Coffee, built from the design system
in [`../DESIGN.md`](../DESIGN.md) (Playfair Display + Work Sans, the espresso /
caramel-gold palette, the wordmark in [`../app/assets`](../app/assets)).

## Logo & icon

- **Primary logo:** the `logo-wordmark*` script wordmark ("make my COFFEE").
- **App icon:** the hand-and-cup mark, derived from `new-logo.png`, cleaned into
  - `../app/assets/logo-icon.png` — cream mark on transparent (for dark surfaces)
  - `../app/assets/logo-icon-badge.png` — mark in an espresso roundel (for light surfaces)
  - `../app/icon.png` — the site favicon (the badge)

  The icon is used for the favicon, the social avatar, and as a small accent on
  the assets below. `new-logo.png` is the original raster source.

| File | Size (px) | Use |
|------|-----------|-----|
| `og-image.png` | 2400×1260 | Social/link preview (Open Graph, 1.91:1). Set as `og:image`. |
| `social-avatar.png` | 2160×2160 | Square profile picture for FB / IG. Safe for circular crop. |
| `bottle-label.png` | 1640×2360 | Front label for the Aconchego shot bottles. Shown as the 7-shot Classic; swap the shot count / volume per size. |
| `business-card-front.png` | 2100×1200 | Business card front (3.5×2in @ 600dpi). |
| `business-card-back.png` | 2100×1200 | Business card back (contact + range). |

Placeholders to confirm before printing: the `@makemycoffee` social handle and
any phone/email you want on the card back.

**Brand board:** the full visual identity (logo lockups, palette, type specimen,
voice, do/don't) lives as a shareable page:
https://claude.ai/code/artifact/576f7b9f-e31b-4d22-b488-e4519416f57c

Assets were rendered from HTML templates (real fonts + the logo PNGs) via a
headless browser at 2× for print crispness.
