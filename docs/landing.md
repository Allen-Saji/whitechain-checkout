# Frontend

The application uses Next.js App Router, React and strict TypeScript. The landing and documentation are prerendered. Wallet actions, order polling, merchant operations and interactive controls run in client components. Fastify and the payment worker remain separate services.

```sh
pnpm dev:web
pnpm typecheck:web
pnpm build:web
pnpm preview:web
```

Development and production preview bind to `http://127.0.0.1:4210`. `pnpm preview:web` runs the production Next.js server and requires a successful build. Keep the API and booking services running separately for payment and merchant pages.

## Routes

| Route                      | Purpose                                              |
| -------------------------- | ---------------------------------------------------- |
| `/`                        | Product landing and recovery walkthrough             |
| `/shop`                    | Server-priced example workshop checkout              |
| `/demo`                    | Compatibility redirect to `/shop`                    |
| `/checkout/:id`            | Buyer authorization, status and printable receipt    |
| `/merchant`                | Wallet sign-in and authenticated merchant operations |
| `/merchant?view=example`   | Explicit read-only example account                   |
| `/start`                   | Merchant setup overview                              |
| `/docs` and `/docs/:guide` | Developer guides and API reference                   |

## Source layout

- `web/app/`: routes, layouts, metadata, loading and error boundaries.
- `web/components/`: typed React UI and interaction components.
- `web/lib/`: API types/client, wallet adapter and documentation content.
- `web/styles/`: shared design styles, product styles and docs styles.
- `web/public/`: fonts, font licenses, icons and generated decorative artwork.
- `web/legacy/`: preserved pre-migration Vite source. Not served or imported by Next.js; do not add features there.

The wallet adapter initializes provider discovery in the browser when needed. UI polling stops on unmount and pauses when the page is hidden. Merchant API keys never enter the frontend.

## Deployment

Run Next.js as an application server, not a static file host. Next rewrites `/v1/*` to `CHECKOUT_API_ORIGIN` (default `http://127.0.0.1:4200`) and `/shop-api/*` to `CHECKOUT_MERCHANT_ORIGIN` (default `http://127.0.0.1:4301`). Configure these server-only origins before building and running the deployment. The booking proxy is for the bundled example; disable or isolate it for deployments without that example.

Set `APP_ORIGIN` on Fastify to the exact external HTTPS frontend origin and `CHECKOUT_BASE_URL` to that origin plus `/checkout`. Preserve request Origin headers and session cookies through the proxy. Never set merchant credentials or relay keys in NEXT_PUBLIC variables.

Next build output under `web/.next/` is ignored. The old `web/dist/` output is no longer served. See [operations](operations.md) for backend and worker deployment requirements.

## Design and verification

The orange sculpture is decorative. DM Sans and Instrument Serif are bundled locally with their licenses; no remote font request is required. Print controls use native browser printing. Motion respects reduced-motion preferences, and layouts adapt to phone widths.

`pnpm check` includes TypeScript checking, lint, contract compilation, offline tests and the production Next.js build. Public testnet evidence predates the framework migration. Browser checks of the migrated routes use existing receipts and do not imply another payment was submitted. Registered merchant wallet sign-in/refund remains an outstanding end-to-end check.
