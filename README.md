# railz-landing

The public landing page for ZemFi. One static file, no build step, no
dependencies — `index.html` is the whole site.

## Why it is plain HTML

It exists to say what the app does and send people to the stores. A framework
would add a build, a deploy pipeline and a dependency tree to a page that
changes when the product does, which is rarely.

## Run it

Open `index.html` in a browser, or serve the directory:

    python3 -m http.server 4173     # then http://localhost:4173

## Deploy

Anything that serves static files: Netlify, Vercel, Cloudflare Pages, S3 +
CloudFront, or an nginx root. Publish the directory; there is nothing to build.

## Editing

- **Copy** lives in the markup, in reading order.
- **Colour, type and spacing** are CSS custom properties on `:root`, with the
  dark palette redefined under `prefers-color-scheme` and `[data-theme="dark"]`.
  Change a token, not a rule.
- **The globe** is a plain `<canvas>` drawn by the script at the bottom of
  the page. `LAND` is a baked list of land points (Natural Earth 110m, via the
  `world-atlas` package, sampled on a 2° grid), so nothing is fetched at
  runtime. The routes it draws come from `PLACES` in the same script; keep
  that list in step with the destinations the app actually supports.
- The brand blue is `#0145CE`, the same value as `primaryColor` in the mobile
  app's `app.json`.

## No company attribution

The page credits no company, by decision: it is a product page for ZemFi and
carries ZemFi information only. An early draft said "by Dutchman Network" —
that was wrong (Dutchman Network is the upstream payments partner, not the
owner) and has been removed. Do not reintroduce a company line without being
asked for one.

The string `com.dutchmannetwork.railz` still appears once, inside the Google
Play URL, because that is the app's package id and the link does not resolve
without it. It is not shown as text anywhere on the page.

## Store links

    Google Play  play.google.com/store/apps/details?id=com.dutchmannetwork.railz
    App Store    apps.apple.com/app/id6807885145

Both are the real identifiers, but **neither resolves publicly until the
listings are out of draft** — Android is on the internal track and iOS has not
been submitted. Check them before announcing the page anywhere.

## What the copy is grounded in

The capability list mirrors `FEATURE_LABELS` in the backend
(`src/modules/features/feature.service.ts`), and the "how money reaches you"
section uses the `Arrival` taxonomy from
`src/modules/currencies/currency.catalogue.ts`. If either changes
substantively, this page should follow.

The page is positioned around stablecoin-backed payments. That rests on two
backend facts: a global send carries an `asset` (USDT or USDC, see
`src/modules/global-send/dto/global-send.dto.ts`), and foreign payments settle
into `RECEIVING_SETTLEMENT_ASSET` (`src/modules/receiving/receiving.controller.ts`).
If payments stop moving on stablecoins, the hero, "How a payment moves" and
the first two FAQ answers need rewriting.

The CBN lines (the security card, the FAQ and the footer) claim only that
verification follows the CBN's tiered KYC framework, which is what the backend
implements (`src/modules/kyc/dto/tier1.dto.ts`, `tier2.dto.ts`). They
deliberately do not say ZemFi is licensed by the CBN. Add a licence claim only
with the licence type and number in hand.

No fiat currencies are named anywhere, deliberately: the served catalogue
currently lists currencies ZemFi does not provide, so the page says "your local
currency" instead of a list that could be wrong.
