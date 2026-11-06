# Browser application

The site lives in `web/`. The marketing page uses HTML, CSS and small JavaScript modules. Product routes load separate application modules and viem for wallet interaction. Fonts and artwork are bundled locally.

```sh
pnpm dev:web
pnpm build:web
pnpm preview:web
```

Development and preview bind to `http://127.0.0.1:4210`. `/v1` proxies to API port 4200; `/shop-api` proxies to the separate booking service on port 4301. See [operations](operations.md) for service configuration. Build output is ignored under `web/dist/`; builds do not delete previous output automatically.

## Routes

- `/`: marketing page, integration example, evidence links and illustrative recovery walkthrough. The primary CTA opens the real demo shop.
- `/shop`: server-priced example workshop purchase (`/demo` remains a compatibility route). A stable browser order ID prevents duplicate creation on retry.
- `/checkout/:id`: wallet selection, Whitechain network selection, bounded token authorization, payment status, fulfillment status, refunds and printable receipt.
- `/merchant`: wallet sign-in, merchant-scoped orders, delivery history/retry and signed partial refunds. Public example activity is only shown when the visitor explicitly opens `/merchant?view=example`.
- `/start`: merchant setup overview.
- `/docs` and `/docs/:guide`: developer guides, API reference, searchable navigation, copyable code and PDF printing.

The checkout distinguishes a queued request, confirmed payment and acknowledged fulfillment. Buyers sign token authorizations; the relayer pays transaction gas. The merchant API key stays in the booking server. Connecting a buyer wallet does not grant merchant access.

## Hosting

Serve `web/dist/index.html` for `/`, and `web/dist/product.html` for `/shop`, `/demo`, `/merchant`, `/start`, `/docs`, `/docs/*` and `/checkout/*`. Serve generated assets normally. Configure same-origin reverse proxies for `/v1/*` and `/shop-api/*`; a static fallback alone cannot operate checkout. Set `APP_ORIGIN` to the exact HTTPS application origin and `CHECKOUT_BASE_URL` to that origin plus `/checkout`. Vite's development proxy is not a production server.

## Design and accessibility

The orange sculpture is decorative; the receipt overlay is HTML. DM Sans and Instrument Serif are bundled with their licenses. `checkout.` remains a provisional wordmark.

The landing walkthrough supports arrow keys, Home and End. Mobile navigation supports Escape, FAQs use native disclosures, and motion respects reduced-motion preferences. Native printing exports a static view. Product pages expose payment progress and errors as status messages; the merchant table scrolls inside its container on phones.

## Verification scope

`pnpm check` covers formatting, lint, contract compilation, offline tests and the production build. Browser checks covered desktop and phone layouts and a real MetaMask buyer authorization on Whitechain Sepolia. A merchant-signed HTTP API refund was confirmed and displayed in the receipt. The registered merchant's browser sign-in/refund flow has not yet been exercised end to end. These checks are not an accessibility audit or a cross-browser certification.
