# zemfi-landing

ZemFi on the web: the public marketing pages and the signed-in web app, in
one Next.js (App Router) project.

## Layout

    src/app/(site)/     marketing pages: /, /careers, /privacy, /terms, /delete-account
    src/app/(web)/      the signed-in web app: /login, /register, /forgot-password, /app/*
    src/components/site/  client pieces of the marketing pages (globe, screen carousel,
                          scroll reveal) and their fonts and data
    public/             logo, favicons and the app screenshots used by the home page

`(site)` and `(web)` each have their own root layout, so neither one's CSS
reaches the other, and moving between them is a full page load. The marketing
pages link to the web app (and to each other) with plain `<a>` for that reason.
The old `*.html` URLs redirect to the new routes (`next.config.ts`).

## Run it

    npm install
    npm run dev        # http://localhost:3000
    npm run build      # production build
    npm start          # serve the production build

## Configuration

| Variable                    | Default                        | Used by                          |
| --------------------------- | ------------------------------ | -------------------------------- |
| `NEXT_PUBLIC_ZEMFI_API_URL` | `https://app.zemfi.ng/api/v1`  | the web app's API client          |

It is read at build time (it is a `NEXT_PUBLIC_` variable), so set it before
`npm run build`.

## Deploy

Deploy it as a Next.js app: Vercel, or any Node host that runs `npm run build`
then `npm start`. It is no longer a folder of static files.

## Editing the marketing pages

- **Copy** lives in the JSX of each page under `src/app/(site)/`, in reading
  order. The home page is `src/app/(site)/page.tsx`.
- **Colour, type and spacing** are CSS custom properties on `:root` in
  `src/app/(site)/site.css`. Change a token, not a rule. Page styles are in
  `home.css` (the home page) and `doc.css` (careers and the legal pages, with
  `careers/careers.css` on top).
- **Fonts** (Bricolage Grotesque, Public Sans, IBM Plex Mono) are loaded with
  `next/font` in `src/components/site/fonts.ts` and feed the `--display`,
  `--body` and `--mono` tokens.
- **The globe** is a plain `<canvas>` drawn by
  `src/components/site/Globe.tsx`. `LAND` in
  `src/components/site/globe-data.ts` is a baked list of land points (Natural
  Earth 110m, via the `world-atlas` package, sampled on a 2° grid), so nothing
  is fetched at runtime. The routes it draws come from `PLACES` in the same
  file; keep that list in step with the destinations the app actually
  supports.
- The brand blue is `#0145CE`, the same value as `primaryColor` in the mobile
  app's `app.json`.

## No company attribution

The pages credit no company, by decision: they are product pages for ZemFi and
carry ZemFi information only. An early draft credited the upstream
payments partner — that was wrong (the partner is not the owner) and has been
removed. Do not reintroduce a company line without being asked for one.

The string `com.dutchmannetwork.railz` still appears once, inside the Google
Play URL in `src/app/(site)/page.tsx`, because that is the app's package id and
the link does not resolve without it. It is not shown as text anywhere on the
page.

## Store links

    Google Play  play.google.com/store/apps/details?id=com.dutchmannetwork.railz
    App Store    apps.apple.com/app/id6807885145

Both are the real identifiers, but **neither resolves publicly until the
listings are out of draft** — Android is on the internal track and iOS has not
been submitted. Check them before announcing the site anywhere.

## What the copy is grounded in

The capability list on the home page mirrors `FEATURE_LABELS` in the backend
(`src/modules/features/feature.service.ts`), and the "how money reaches you"
section uses the `Arrival` taxonomy from
`src/modules/currencies/currency.catalogue.ts`. If either changes
substantively, the home page should follow.

The home page is positioned around stablecoin-backed payments. That rests on
two backend facts: a global send carries an `asset` (USDT or USDC, see
`src/modules/global-send/dto/global-send.dto.ts`), and foreign payments settle
into `RECEIVING_SETTLEMENT_ASSET` (`src/modules/receiving/receiving.controller.ts`).
If payments stop moving on stablecoins, the hero, "How a payment moves" and
the first two FAQ answers need rewriting.

The CBN lines (the security card, the FAQ and the footer of the home page)
claim only that verification follows the CBN's tiered KYC framework, which is
what the backend implements (`src/modules/kyc/dto/tier1.dto.ts`,
`tier2.dto.ts`). They deliberately do not say ZemFi is licensed by the CBN.
Add a licence claim only with the licence type and number in hand.

No fiat currencies are named anywhere, deliberately: the served catalogue
currently lists currencies ZemFi does not provide, so the page says "your local
currency" instead of a list that could be wrong.
