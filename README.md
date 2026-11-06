<p align="center"><img src="web/public/mark.svg" width="64" height="64" alt="Checkout logo" /></p>
<h1 align="center">Checkout</h1>
<p align="center">USDT payments. Orders accounted for.</p>
<p align="center"><a href="docs/getting-started.md">Get started</a> | <a href="docs/integration.md">Integration</a> | <a href="docs/architecture.md">Architecture</a> | <a href="CONTRIBUTING.md">Contribute</a></p>

Checkout connects a USDT payment to the order behind it. Customers authorize a payment, the relayer covers gas, and merchants receive funds directly. Confirmed payments create durable receipts and signed notifications; merchants can retry delivery and authorize partial refunds from their workspace.

## What is included

- Wallet checkout with payment status, fulfillment status and printable receipts.
- Merchant workspace with wallet sign-in, order history, notification retries and refunds.
- Server SDK for checkout creation, fulfillment acknowledgement and refund submission.
- Persist-before-broadcast relayer, confirmed-event indexer and retrying webhook outbox.
- Solidity payment router with order-bound authorizations and cumulative refund limits.
- In-app developer documentation with copyable examples at `/docs`.

## Stack

Next.js App Router, React and TypeScript for the frontend. Fastify, viem and SQLite for the API and worker. Solidity for payment accounting.

## Run locally

Requires Node 22.13+ in the 22.x line or Node 24+, and pnpm 10.8.1.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm dev:web
```

Open `http://127.0.0.1:4210`. The landing page and documentation work without the API. Checkout and the workspace require the API, worker and configured merchant service; follow the [setup guide](docs/getting-started.md). API credentials and relay keys stay server-side.

| Route           | Purpose                            |
| --------------- | ---------------------------------- |
| `/`             | Product overview                   |
| `/merchant`     | Merchant sign-in and workspace     |
| `/start`        | Integration setup overview         |
| `/docs`         | Developer guides and API reference |
| `/shop`         | Example merchant checkout          |
| `/checkout/:id` | Buyer authorization and receipt    |

## Integration

The server SDK is included in this repository; it is not an npm package. From an integration file at the repository root:

```js
import { checkoutClient } from './sdk/server.mjs';

const checkout = checkoutClient({
  baseUrl: process.env.CHECKOUT_API,
  apiKey: process.env.CHECKOUT_API_KEY,
});

const order = await checkout.create({
  orderId: 'booking-1042',
  amount: '2000000', // 2 USDT
});
// Redirect the customer to order.checkoutUrl.
```

Set `CHECKOUT_BASE_URL` on the API to enable checkout URLs. Verify webhook signatures, persist fulfillment idempotently, then acknowledge completion. See the [integration guide](docs/integration.md) and [complete booking example](examples/booking/server.mjs).

## Repository structure

| Directory                 | Responsibility                                      |
| ------------------------- | --------------------------------------------------- |
| `contracts/`              | Payment and refund accounting                       |
| `src/api/`                | Checkout, merchant and session endpoints            |
| `src/workers/`            | Relayer, indexing and notification delivery         |
| `src/storage/migrations/` | Versioned SQLite schema                             |
| `sdk/`                    | Server integration client and webhook verifier      |
| `web/`                    | Landing, product application and documentation      |
| `examples/booking/`       | Independent merchant integration                    |
| `tests/`                  | API, persistence, cryptographic and fork checks     |
| `deployments/`            | Deployment manifests and public settlement evidence |

## Verification

`pnpm check` runs formatting, lint, strict frontend type checking, Solidity compilation, offline tests and the Next.js production build. `pnpm test:fork` runs the full suite against an isolated Anvil fork, including process recovery, merchant isolation, wallet sessions, notification replay and partial refunds. See [operations](docs/operations.md) for fork setup. CI runs on pull requests and manual dispatch.

The recorded deployment is Whitechain Sepolia, chain 1874, using USDT at `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`. Public evidence includes a [2 USDT payment and 0.5 USDT refund](deployments/whitechain-sepolia/smoke-result.json), plus a [MetaMask checkout and partial refund](deployments/whitechain-sepolia/browser-checkout-result.json). The latter refund was exercised through the authenticated API; merchant browser refund testing remains outstanding.

## Deployment and security

This deployment uses test assets. Public application hosting, mainnet deployment and independent security review are not complete. Explorer source verification is pending. The current system uses single-host SQLite; automatic reorg rollback and transaction fee replacement are not implemented.

Payment goes directly to the merchant. Refunds require the merchant's authorization and available funds; Checkout does not provide escrow or guarantee refunds. Browser authentication supports EOA wallets. Merchant registration is operator-managed.

Read [architecture](docs/architecture.md), [operations](docs/operations.md) and [security policy](SECURITY.md) before running the service. Contributions are covered in [CONTRIBUTING.md](CONTRIBUTING.md). A project-wide software license has not yet been selected; public source availability does not grant an open-source license. Bundled fonts retain their own license files.
