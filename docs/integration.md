# Integration guide

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
