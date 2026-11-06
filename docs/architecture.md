# Architecture

## Responsibilities

The API validates merchant credentials, fixes order terms, verifies buyer or merchant authorization, and queues work. It never treats an HTTP payment request as payment confirmation.

The relayer signs one transaction at a time. It reserves an execution-gas budget, persists the raw signed bytes and hash, and broadcasts those bytes. The indexer reads confirmed contract events and changes payment state together with the corresponding webhook outbox entry in one database transaction. The outbox delivers signed events with retries. The merchant owns business fulfillment and acknowledges it separately.

Module boundaries:

| Module                    | Responsibility                                                       |
| ------------------------- | -------------------------------------------------------------------- |
| `src/api/checkouts.mjs`   | Merchant-priced checkout creation and buyer authorization            |
| `src/api/merchant.mjs`    | Merchant order views, delivery retry and fulfillment acknowledgement |
| `src/api/refunds.mjs`     | Refund reservation and merchant-signed submission                    |
| `src/protocol.mjs`        | Token identity, EIP-712 payload and order-bound nonces               |
| `src/workers/relay.mjs`   | Simulation, fee caps, transaction signing and rebroadcast            |
| `src/workers/indexer.mjs` | Confirmation threshold, event validation and durable receipts        |
| `src/workers/outbox.mjs`  | HTTP delivery, HMAC headers and retry scheduling                     |
| `src/worker-core.mjs`     | Worker lease and cycle orchestration                                 |
| `src/storage/migrations/` | Ordered, versioned database schema                                   |
| `examples/booking/`       | Separate merchant application and business database                  |

## State and consistency

Payment jobs move from `queued` to `signed`, `broadcast`, and `confirmed`. `mined` means a successful receipt was observed before the configured confirmation threshold. An explicit revert, expired queued authorization, failed simulation or exceeded budget results in `failed`. A lost broadcast response leaves signed bytes available for retry. The service does not submit a new transaction with a new nonce to resolve an uncertain response.

An order moves from `created` through `queued` to `paid`. Confirmed refunds move it to `partially_refunded` or `refunded`. Fulfillment is a separate field: `pending`, `fulfilled`, or `unavailable`. Delivery success does not imply business fulfillment.

An outbox event has one stable event ID derived from the transaction hash and log index. Its payload is stable across retries; its timestamp and HMAC are fresh. The receiver must persist business idempotency. The booking example uses a unique order key and repeats the fulfillment acknowledgement if the first acknowledgement failed after booking creation.

The worker holds a renewable database lease and checks ownership before persisting results after asynchronous work. An expired owner must not overwrite a new worker's result. A changed checkpoint block hash halts processing for investigation. This is fail-closed detection, not automatic reorg reconciliation.

## Contract boundary

Each payment token authorization binds the token and chain through EIP-712, and the checkout contract, order ID, buyer, merchant, amount and deadline through its nonce. The contract receives the token authorization and forwards the exact amount atomically. It checks recipient and contract balance deltas. Refunds bind the original receipt and a unique refund ID, require the merchant's signature, and cannot cumulatively exceed the paid amount.

The relay is permissioned. The service is trusted to create merchant-priced orders and deliver their events. The administrator can pause payments and rotate the relay. Neither the service nor the contract can force a merchant to authorize or fund a refund. This design does not provide escrow, chargebacks or buyer protection.

## Extending the service

Keep route modules focused on validation and application operations. Share authorization encoding through `protocol.mjs`; do not duplicate the nonce rules in clients. Add a regression test for each failure mode before changing worker persistence or payment/refund accounting.

Database startup reads `PRAGMA user_version` inside a transaction. Version 1 preserves existing prototype rows and adds queue indexes and refund-job uniqueness. Version 2 adds wallet sign-in challenges and hashed merchant sessions. Add a new numbered migration and increment the supported version for future schema changes. Never silently rewrite existing migration semantics or open a newer schema with older code.

The current SQLite deployment is single-host. A multi-host deployment needs a shared transactional store, explicit locking/leases, distributed rate limits, and migration coordination. Do not share one relay key across independent databases.

## Browser authentication

Merchant sign-in verifies an EOA signature over a domain-bound message with a single-use, five-minute challenge. A successful signature creates a seven-day HttpOnly, SameSite=Strict session cookie (Secure on HTTPS). Only the token hash is stored. Logout revokes the session. Merchant mutations authenticated with cookies require an exact `APP_ORIGIN` match. Server integrations retain bearer API keys; these keys never enter the browser.

The payout address must already belong to an operator-provisioned merchant. Signing in does not create a merchant. The public `/v1/demo` endpoint is disabled unless `DEMO_MERCHANT_ID` explicitly selects a demo merchant whose order and delivery data may be public. Keep customer information out of that fixture.

`DEMO_WORKER=0` prevents payment/refund submission and worker cycles. This is an application pause, separate from the onchain payment pause, and also suspends indexing and notification retries.
