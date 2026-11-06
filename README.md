# Whitechain checkout

Sponsored USDT checkout with durable payment submission, merchant delivery retries, and merchant-authorized partial refunds.

The service uses Whitechain Sepolia (chain 1874) and token `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`. Buyers sign an EIP-3009 authorization. The relayer submits it and pays transaction gas. The contract transfers the exact payment to the merchant atomically and retains no payment funds. Refunds require a new authorization from the merchant and sufficient merchant USDT.

## Live testnet evidence

The live checkout completed a 2 USDT payment and a 0.5 USDT partial refund using the required token. Buyer and merchant both held zero WBT; the relayer sponsored execution. The separate merchant backend recovered from an HTTP 503 outage and acknowledged fulfillment.

- [Payment transaction](https://explorer.testnet.whitechain.io/tx/0x7803084d3483a045a5c752c39560067a245ef7ec6f929200922dd54439ea17fc)
- [Partial refund transaction](https://explorer.testnet.whitechain.io/tx/0x5ac212bf80be6863c040b6a4742783aaef72be952b0fb9042a9cbc5e4057e8cf)
- [Public result](deployments/whitechain-sepolia/smoke-result.json)

This flow is useful for buyers who already hold USDT and merchants who want direct wallet settlement with independently readable receipts. A regular card payment would use a separate payment provider and conversion path to achieve that onchain settlement. Recovery and refunds are application features; they do not by themselves require a blockchain.

See [architecture](docs/architecture.md) for trust boundaries and state transitions, and [operations](docs/operations.md) for deployment, local fork setup and recovery procedures.

A separate browser checkout completed a 0.1 USDT payment signed in MetaMask and a 0.05 USDT refund signed through the authenticated merchant HTTP API. The receipt records confirmed settlement and fulfillment. See [browser flow evidence](deployments/whitechain-sepolia/browser-checkout-result.json). The merchant browser refund controls still require a separate owner-wallet end-to-end check.

## Components

- `contracts/RelayCheckout.sol`: payment receipts, cumulative refund limits, relay rotation, payment pause. Refunds remain enabled while paused.
- `src/api.mjs`: immutable merchant-priced orders, signature validation, merchant-scoped APIs, receipt history and fulfillment acknowledgement.
- `src/worker-core.mjs`: persisted signed transactions, confirmed-event indexing, execution-gas reservations and signed webhook retries.
- `sdk/server.mjs`: server-only integration client and raw-body webhook verifier.
- `examples/booking/server.mjs`: separate workshop merchant with server-owned pricing and durable, idempotent booking creation.

## Browser application

Run `pnpm dev:web` to view the site at `http://127.0.0.1:4210`. The application includes a demo shop at `/demo`, wallet checkout and receipts at `/checkout/:id`, and merchant operations at `/merchant`. Build with `pnpm build:web`. See [browser documentation](docs/landing.md) and [service setup](docs/operations.md).

## Run

Use Node 22.13+ in the 22.x line or Node 24+, and pnpm 10.8.1. Node 22 emits an experimental warning for SQLite.

```sh
pnpm install --frozen-lockfile
pnpm compile
pnpm check
pnpm test:fork
```

Network tests require an isolated Anvil fork at `http://127.0.0.1:8550`, chain 1874. They check the node identifies as Anvil before impersonating the token owner for fixture funding. They do not fund or transact on public testnet. Fork tests create fresh contracts, retain evidence under ignored `.local/test-*`, and configure `.local/fork-wallet.json` plus `.local/fork-deployment.json`. The fork stays available after testing.

Provision a merchant with its public payout address. For local development, the webhook must be loopback HTTP:

```sh
LOCAL_FORK=1 node scripts/create-merchant.mjs YOUR_PUBLIC_PAYOUT_ADDRESS http://127.0.0.1:4300/webhook
LOCAL_FORK=1 pnpm start
LOCAL_FORK=1 pnpm worker
node examples/booking/server.mjs
```

Run these services in separate terminals, from the repository root. Merchant credentials are written to `.local/merchant-fork.json` with mode 0600 and never printed. The default local API database is `.local/fork.sqlite`; tests use their own unique databases. Do not run multiple deployments against the same relay wallet.

For public testnet, omit `LOCAL_FORK`, use the separate testnet wallet/deployment files, and provision a reviewed HTTPS merchant webhook. `MERCHANT_CONFIG` selects the demo's credentials file. The service binds to loopback; deployment requires a TLS reverse proxy and managed secrets. No public hosting is configured here.

Set `CHECKOUT_BASE_URL` to the application origin followed by `/checkout`. Until configured, `checkoutUrl` is null. The checkout UI is bundled; public hosting and embedded wallets are not configured.

## Integration contract

All amounts are positive integer strings in token base units (USDT has six decimals). Merchant endpoints require `Authorization: Bearer <merchant API key>`. Keep this key on your server.

1. Merchant server calls `POST /v1/checkouts` with `{orderId, amount}`. `orderId` is idempotent within the merchant. Changing its amount returns 409.
2. Buyer client gets `POST /v1/checkouts/:id/authorization` with `{payer}` and signs the returned typed data. A browser signer may require JSON integer strings to be converted to BigInt.
3. Buyer sends `{payer, signature}` to `POST /v1/checkouts/:id/pay`. A queued response is not proof of payment. Repeated submission returns the same job.
4. Poll `GET /v1/checkouts/:id` for confirmed state and transaction history. The checkout UUID acts as a receipt-access capability; do not put private customer information in `orderId`.
5. Merchant verifies the exact raw webhook body, timestamp and HMAC, then persists fulfillment idempotently using the order ID. Webhook delivery alone does not mark fulfillment complete.
6. Merchant calls `POST /v1/merchant/orders/:id/fulfillment` with `{state:"fulfilled"}` or `{state:"unavailable"}`. Use the checkout UUID as `:id`.

The server SDK exposes `create`, `fulfill`, `refund`, and `submitRefund`. The separate booking app shows the complete integration, including its own business database. A short adapter can connect existing pricing and fulfillment functions; a browser snippet cannot safely own merchant pricing, API credentials, or fulfillment.

Webhook headers are `x-checkout-timestamp` (Unix seconds) and `x-checkout-signature` (hex HMAC-SHA256 of `timestamp + "." + rawBody`). The verifier permits five minutes of clock skew. Delivery retries use the same event ID and fresh signature. Successful 2xx responses stop automatic delivery retries. Merchant delivery history and explicit replay are available at `/v1/merchant/deliveries` and `/v1/merchant/deliveries/:id/retry`.

Refund flow: request authorization at `POST /v1/merchant/orders/:id/refunds` with `{refundId, amount}`; have the merchant payout wallet sign the returned authorization; submit the signature to `POST /v1/merchant/refunds/:id/submit`. A refund request is not a completed refund. Poll confirmed order history. Pending refund reservations count against the original paid amount; unsigned expired reservations are released by the worker.

## Recovery and boundaries

- Signed raw transaction bytes and their hash are saved before broadcast. A new worker process rebroadcasts the same bytes after a crash. The relay processes one unresolved transaction at a time. A stuck transaction currently requires operator investigation; automatic fee replacement is not implemented.
- Chain events and webhook outbox entries are written in one SQLite transaction. The worker uses three confirmations on testnet and one on the local fork. A changed checkpoint block hash halts processing for operator review; automatic reorg rollback is not implemented.
- Webhooks are delivered at least once. The merchant must make its business operation idempotent. The demo uses SQLite uniqueness constraints and retries acknowledgement after restart.
- SQLite WAL and a renewable worker lease coordinate one local deployment. This is not a distributed multi-region queue. The database, its backups, and local credentials require restricted access.
- Per-job and daily merchant limits reserve estimated EVM execution fees conservatively. Additional chain data fees are not included, so these are not total WBT spend guarantees. Reservations are not automatically refunded when execution is cheaper. Relayer balance monitoring and production cost accounting remain necessary.
- Public API requests have an in-process IP limit of 120 requests/minute. The default does not trust forwarded IP headers. Multi-instance rate limiting and explicit reverse-proxy configuration remain deployment work.
- Webhook destinations are operator-provisioned; redirects are disabled and requests time out after five seconds. Public hosting needs an egress policy for private addresses and DNS rebinding before self-service merchant onboarding.
- API authorization currently supports EOA signatures. ERC-1271 contract-wallet signatures and embedded/passkey onboarding are not implemented.
- An administrator can rotate the relay and pause new payments. The platform relay enforces merchant order creation; signed token authorization binds recipient, amount, deadline, chain, token and checkout contract. This is not a permissionless merchant quote protocol.
- The contract cannot guarantee a refund if a merchant spends its balance or refuses to authorize it. Funds are paid directly to the merchant.

## Tests

Security checks cover webhook forgery/expiry, merchant isolation, immutable pricing, rate limiting, fail-closed chain status, and larger gas estimates after a reservation.

The fork integration test restarts worker processes between signing and broadcast, confirms a payment during a merchant outage, replays delivery without a second booking, refunds while payments are paused, checks unauthorized admin calls, and enforces the execution-gas budget. Buyer and merchant retain zero WBT.

The separate booking-process test uses a controlled API fixture to force an acknowledgement failure after durable booking creation. It restarts the real merchant process and proves duplicate delivery leaves one booking. This is separate from the onchain integration test.

Public testnet contract: `0x43fbe3884038e34e811cf251ae00dfd5df826034`. Explorer source verification is pending: the verification endpoint returned HTTP 403 with "Contract verification is temporarily unavailable." Live test-USDT payment and refund are complete; explorer source verification remains pending.
