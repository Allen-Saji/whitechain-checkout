# Add Checkout to your app

Start by [creating an account](https://checkout.allensaji.dev/register), saving your API key and webhook secret, and verifying your HTTPS webhook in [Integration settings](https://checkout.allensaji.dev/merchant/settings). The hosted API base URL is `https://checkout.allensaji.dev`. You do not need access to the Checkout database.

All amounts are positive integer strings in token base units (USDT has six decimals). Merchant endpoints require `Authorization: Bearer <merchant API key>`. Keep this key on your server.

1. Merchant server calls `POST /v1/checkouts` with `{orderId, amount}`. `orderId` is idempotent within the merchant. Changing its amount returns 409.
2. Buyer client gets `POST /v1/checkouts/:id/authorization` with `{payer}` and signs the returned typed data. A browser signer may require JSON integer strings to be converted to BigInt.
3. Buyer sends `{payer, signature}` to `POST /v1/checkouts/:id/pay`. A queued response is not proof of payment. Repeated submission returns the same job.
4. Poll `GET /v1/checkouts/:id` for confirmed state and transaction history. The checkout UUID acts as a receipt-access capability; do not put private customer information in `orderId`.
5. Merchant verifies the exact raw webhook body, timestamp and HMAC, then persists fulfillment idempotently using the order ID. Webhook delivery alone does not mark fulfillment complete.
6. Merchant calls `POST /v1/merchant/orders/:id/fulfillment` with `{state:"fulfilled"}` or `{state:"unavailable"}`. Use the checkout UUID as `:id`.

The server SDK exposes `create`, `fulfill`, `refund`, and `submitRefund`. The separate booking app shows the complete integration, including its own business database. A short adapter can connect existing pricing and fulfillment functions; a browser snippet cannot safely own merchant pricing, API credentials, or fulfillment.

Webhook headers are `x-checkout-timestamp` (Unix seconds) and `x-checkout-signature` (hex HMAC-SHA256 of `timestamp + "." + rawBody`). The verifier permits five minutes of clock skew. Delivery retries use the same event ID and fresh signature. Successful 2xx responses stop automatic delivery retries. Merchant delivery history and explicit replay are available at `/v1/merchant/deliveries` and `/v1/merchant/deliveries/:id/retry`.

Refund flow: request authorization at `POST /v1/merchant/orders/:id/refunds` with `{refundId, amount}`; have the merchant payout wallet sign the returned authorization; submit the signature to `POST /v1/merchant/refunds/:id/submit`. A refund request is not a completed refund. Poll confirmed order history. Pending refund reservations count against the original paid amount; expired unsigned reservations stop reducing the available amount, including while processing is paused.

## Install in another application

From a repository checkout, run `npm pack ./sdk`. Install the generated `whitechain-checkout-server-0.1.0.tgz` in your server project. The package exports `checkoutClient` and `verifyWebhook` with TypeScript declarations and uses only Node built-ins. It is not published to npm. Keep your existing application authentication and persistence.

```js
import { checkoutClient } from '@whitechain-checkout/server';
const checkout = checkoutClient({
  baseUrl: process.env.CHECKOUT_API,
  apiKey: process.env.CHECKOUT_API_KEY,
});
const order = await checkout.create({
  orderId: 'membership-1042',
  amount: '1000000',
  title: 'Studio membership',
  description: 'One month of studio access',
});
```

Price, title and description are immutable for a given merchant order ID. Derive them from server data, not a browser-submitted price. Checkout snapshots your business name when creating the order. Do not put personal or sensitive data into public receipt metadata. Older orders without metadata display generic labels.

The [integration skill](../sdk/skills/integrate-checkout/SKILL.md) gives coding agents the integration sequence and verification boundaries. The public [OpenAPI document](https://checkout.allensaji.dev/openapi.json) covers merchant integration endpoints. Wallet registration and sign-in are available through the hosted UI.

## Refund reservations

Use `checkout.refunds(checkoutId)` to read `available`, `reserved`, and refund history before choosing an amount. `checkout.cancelRefund(refundId)` releases an unsubmitted reservation. Closing a wallet prompt does not cancel it. Expired unsubmitted reservations stop reducing the available balance even when the worker is paused. Submitted refunds cannot be cancelled; wait for confirmation before creating another request.
