# Deployment

Use one backend service for Fastify and its worker, sharing one persistent SQLite volume. Host the Next.js frontend separately. Do not run independent workers with the same relay wallet and separate databases.

## Backend container

```sh
docker build -f Dockerfile.backend -t checkout-backend .
```

The image compiles the contract ABI, installs runtime dependencies and starts `src/runtime.mjs`. Its entrypoint initializes `/data` ownership, then drops to the unprivileged node user. Mount a persistent volume at `/data`; the database defaults to `/data/checkout.sqlite`. Graceful shutdown stops the HTTP server and waits for the current worker cycle before closing SQLite.

Configure these variables in the hosting platform:

| Variable                        | Purpose                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `RELAY_PRIVATE_KEY`             | Relay wallet secret. Set through the platform secret store.                     |
| `PORT`                          | HTTP listen port; Railway can provide it.                                       |
| `HOST`                          | `0.0.0.0` inside the container.                                                 |
| `DB_PATH`                       | `/data/checkout.sqlite`.                                                        |
| `APP_ORIGIN`                    | Exact HTTPS frontend origin for wallet authentication.                          |
| `CHECKOUT_BASE_URL`             | Frontend origin followed by `/checkout`.                                        |
| `DEMO_WORKER`                   | `0` during setup; explicitly set `1` to process transactions.                   |
| `MERCHANT_REGISTRATION_ENABLED` | `1` to permit wallet-signed account creation.                                   |
| `GLOBAL_DAILY_GAS_BUDGET`       | Shared daily execution-gas reservation cap in wei; default `50000000000000000`. |
| `REGISTRATION_DAILY_GAS_BUDGET` | Initial per-merchant cap in wei; default `1000000000000000`.                    |

With an environment relay key, the service reads the public testnet deployment manifest by default. `DEPLOYMENT_PATH` can select another manifest. Startup validates chain, token and configured relay against the contract. No private wallet file is included in the image.

On Railway, select `Dockerfile.backend` using `RAILWAY_DOCKERFILE_PATH`, attach the `/data` volume, use one replica and configure `/health` as the health check. Disable application sleeping for an active worker. Use the current Railway service settings or Infrastructure as Code; new services cannot use the deprecated railway.toml format.

Before enabling the hosted worker, stop the local worker and import a consistent SQLite backup if moving an existing deployment. Preserve the signed transaction journal, reservations, checkpoints and outbox together. Do not copy an active SQLite main file without its WAL or a supported backup operation.

## Vercel frontend

Use project root `web`, framework Next.js, install command `cd .. && pnpm install --frozen-lockfile`, and build command `pnpm exec next build`. Dependencies are locked in the repository root; `web/package.json` identifies the frontend package and framework.

Set server-only `CHECKOUT_API_ORIGIN` to the Railway backend origin before building. Set `CHECKOUT_MERCHANT_ORIGIN` only when deploying the separate example booking service. Never expose a relay key, API key or signing secret through a NEXT_PUBLIC variable.

The frontend domain is `checkout.allensaji.dev`. The API must use `APP_ORIGIN=https://checkout.allensaji.dev` and `CHECKOUT_BASE_URL=https://checkout.allensaji.dev/checkout`. The Next.js rewrites keep browser API requests same-origin and preserve authentication cookies.

## Verification

Check `/health`, confirm the public config reports the intended chain/router and paused state, and verify a fresh wallet challenge includes the correct frontend origin. Check existing receipts after migrating data. Then test merchant registration, notifications and refunds with explicit wallet consent before enabling general use. Set spending alerts and monitor credits, relayer balance and delivery failures.

## Hosted example merchant

Build Dockerfile.merchant and mount a separate volume at /data. Set MERCHANT_API_KEY and MERCHANT_WEBHOOK_SECRET in the platform secret store, CHECKOUT_API to the backend HTTPS origin, PORT=4301, BOOKING_HOST=0.0.0.0, BOOKING_DB=/data/bookings.sqlite and DEMO_PRICE to the intended token amount. The service exposes /health, /product, /book and a signature-verifying /webhook. Set the merchant notification endpoint to its public /webhook URL and run a connection check before accepting orders.

Set CHECKOUT_MERCHANT_ORIGIN on Vercel to expose the example shop. Public workspace history is separate: CHECKOUT_PREVIEW_ENABLED and backend DEMO_MERCHANT_ID must both be explicitly configured for a suitable sample account. Do not expose ordinary merchant order history by enabling the shop.

For a bounded rehearsal, set RELAY_CHECKOUT_ID to one existing checkout UUID plus RELAY_MAX_PAYMENT_AMOUNT and RELAY_MAX_REFUND_AMOUNT in token base units. API submission and worker signing/rebroadcast both enforce the scope. Unknown persisted transactions halt rather than being skipped. Keep these settings while pausing the relayer after the run.
