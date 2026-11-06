---
name: integrate-checkout
description: Integrate Checkout USDT payments into an existing application's server, hosted checkout redirect, signed webhook receiver and fulfillment flow. Use for Checkout SDK integration; preserve the application's framework and authentication.
---

# Integrate Checkout

Checkout settles USDT directly to a merchant on Whitechain Sepolia (chain 1874). The relayer pays transaction gas. The currently supported wallet flow is EOA token authorization. Do not represent this deployment as mainnet or promise escrow, guaranteed refunds, embedded wallets, or an npm registry release.

## Read the current contract

Start with https://checkout.allensaji.dev/docs/quickstart and https://checkout.allensaji.dev/llms-full.txt. Machine-readable endpoint reference: https://checkout.allensaji.dev/openapi.json. Source and complete durable booking example: https://github.com/Allen-Saji/whitechain-checkout/tree/main/examples/booking . Check `/v1/config` for current relay availability; a paused relay is not an integration failure.

The SDK is packaged under `sdk/` in that repository. From a checkout of the repo, run `npm pack ./sdk` and install the resulting tarball into the target application. It exports `checkoutClient` and `verifyWebhook` from `@whitechain-checkout/server`, with TypeScript declarations. It has not been published to npm. Do not run `npm install @whitechain-checkout/server` against the registry assuming it exists.

## Integration sequence

1. Identify the existing server route, authoritative product price, durable order store, fulfillment action and application auth. Extend those components; do not scaffold a replacement app or change its stack.
2. Register the merchant at `/register` with its payout wallet. API keys and webhook secrets belong in server-only environment variables. Never place them in `NEXT_PUBLIC_*`, browser code, URLs, logs or commits. The user supplies or authorizes storage of credentials; never request a wallet seed phrase.
3. Create a checkout from an authenticated server endpoint. Derive the amount from the product database, not the browser. Use a stable order ID for idempotency; reuse it after timeouts. USDT uses six decimals: `1000000` is 1 USDT. Send `title` and optional `description`; price and metadata cannot change for an existing order ID. Do not put personal data in receipt metadata. Persist the returned checkout ID and redirect to `checkoutUrl`.
4. Implement a public HTTPS webhook. Read the raw request text before JSON parsing. Check `x-checkout-timestamp` and `x-checkout-signature` using `verifyWebhook(secret,timestamp,rawBody,signature)`. Reject invalid signatures. Enforce a durable unique event ID/order constraint and validate checkout ID, amount and merchant against your stored order.
5. Return 2xx after durable acceptance. Complete fulfillment idempotently, then call `client.fulfill(checkoutId)`. If an external fulfillment action fails, retain a durable retry task. A received event is not proof that delivery to the customer finished. Use `/merchant/settings` to send the signed connection check before creating the first checkout.
6. Use hosted receipts as status links. Never fulfill from a redirect, client-submitted payment status, queued job or submitted wallet signature alone. Confirmed payment events are the settlement signal.

## Refunds and recovery

`client.refund` reserves an amount and returns typed authorization. The merchant wallet must sign it before `submitRefund`. Show pending reservations; `refunds` reports available amounts. `cancelRefund` only releases unsubmitted reservations. Refunds already submitted cannot be cancelled. The wallet needs sufficient USDT. A full refund uses the current available balance, not the original price.

`retryPayment` is authenticated and limited to failed, unbroadcast payments with valid original authorization. It never resets or replaces a signed/broadcast transaction. Fix the underlying budget/balance issue first. Expired authorizations need a new order. Never patch the database, reuse another merchant's credentials or disable signature verification to make an integration pass.

## Verify before handing off

Run the host app's checks. Test fixed server pricing, duplicate order creation, invalid webhook signatures, duplicate event delivery, fulfillment failure/retry and secret exclusion from the client bundle. Use an isolated local chain for transactions unless the user has approved a specific public-network test. Report the network, what was actually verified, any external setup still needed, and the existing files changed. Do not claim a live payment from mocked responses.
