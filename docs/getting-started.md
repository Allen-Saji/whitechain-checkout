# Get started

The browser documentation is served at `/docs` by the web application. This guide covers repository setup; the [integration guide](integration.md) covers server calls.

## Install and verify

Use Node 22.13+ in the 22.x line or Node 24+, and pnpm 10.8.1.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm dev:web
```

The landing and documentation run at `http://127.0.0.1:4210` without backend services. Product screens require the API and merchant integration. See [operations](operations.md) for the isolated fork, testnet deployment and service supervisor.

## Register a merchant

Registration is currently operator-managed. Choose a payout address controlled by the merchant and a reviewed HTTPS webhook endpoint. Run from the configured service checkout, with DB_PATH pointing to the same database as the API:

```sh
DB_PATH=.local/service.sqlite node scripts/create-merchant.mjs \
  YOUR_PUBLIC_PAYOUT_ADDRESS \
  https://your-business.example/webhook
```

This requires the configured deployment and relay wallet files, compiled contract artifact and reachable RPC. The script writes `.local/merchant-testnet.json` with mode 0600 and refuses to overwrite it. It generates a merchant ID, API key and webhook secret. Do not delete an existing credentials file to register another merchant; multiple credential-file destinations are not yet supported by this script.

For the isolated fork, set `LOCAL_FORK=1`, use that fork's database and a loopback HTTP webhook. Credentials are written to `.local/merchant-fork.json`. Never run independent databases against one relay key.

## Connect the application

1. Set APP_ORIGIN to the exact browser origin and CHECKOUT_BASE_URL to that origin plus `/checkout`.
2. Configure the merchant server with its API key and webhook secret. Keep both off the frontend.
3. Create checkout orders from server-owned prices and stable order IDs.
4. Verify raw-body webhook signatures, persist fulfillment once, and acknowledge it.
5. Sign in at `/merchant` using the registered payout wallet. An unrelated buyer wallet cannot manage that merchant's orders.

For the bundled booking example, MERCHANT_CONFIG selects the credential file and BOOKING_DB selects its independent business database. The `pnpm demo` supervisor remains a development command; DEMO_WORKER=0 disables new payment/refund submission and worker cycles. See [operations](operations.md) for complete environment variables and routing.

## Production routing

Run the Next.js server with `pnpm build:web` and `pnpm preview:web`. Configure its server-only `CHECKOUT_API_ORIGIN` and `CHECKOUT_MERCHANT_ORIGIN` to reach the Fastify API and example booking service. Built-in rewrites keep browser requests same-origin. Set APP_ORIGIN and CHECKOUT_BASE_URL on the API to match the public HTTPS frontend origin. See [frontend deployment](landing.md) for details.
