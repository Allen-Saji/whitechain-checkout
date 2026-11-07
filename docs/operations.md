# Operations

## Local verification

Use Node 22.13 or newer in the 22.x line, or Node 24+. Install with `pnpm install --frozen-lockfile`, then run `pnpm check`. CI runs these checks on pull requests and manual dispatch. It does not run public-chain writes.

Run the complete integration suite against an isolated fork:

```sh
docker run -d --name whitechain-checkout-probe \
  -p 127.0.0.1:8550:8545 --entrypoint anvil \
  ghcr.io/foundry-rs/foundry:v1.5.1 \
  --host 0.0.0.0 --fork-url https://rpc.testnet.whitechain.io \
  --chain-id 1874 --silent
pnpm compile
pnpm test:fork
```

Use the existing container if one is already running. Fork tests check that the endpoint is Anvil before impersonating the token owner for fixture funding. They create fresh contracts and preserve their evidence under `.local/`. They do not write to public testnet.

## Testnet wallet and deployment

`node scripts/create-wallet.mjs` creates a fresh test-only wallet and prints its public address. It refuses to overwrite an existing wallet. Fund that address with WBT and the required USDT on chain 1874. `node scripts/balances.mjs` prints public balances only. Keep private keys and merchant credentials out of browser bundles, repositories and logs.

`node scripts/deploy-testnet.mjs` deploys a checkout only if no deployment or pending deployment is recorded. It saves signed bytes before broadcasting. If interrupted, reconcile the saved transaction hash before attempting another deployment. Do not delete the journal to get around the guard.

`deployments/whitechain-sepolia/compiler-input.json` preserves the exact source used for the recorded deployment. The readable contract source was subsequently formatted; source formatting changes compiler metadata. `node scripts/check-deployment.mjs` compiles the preserved input and verifies exact creation calldata and constructor arguments against the successful deployment transaction. This check is independent of explorer source verification.

`node scripts/verify-testnet.mjs` submits that preserved input to the explorer. An accepted verification request still needs an explorer result before the deployment can be described as verified. The explorer initially returned 403 with verification temporarily unavailable. Retrying on November 7, 2026 succeeded; the deployed contract now has exact-match source verification.

## Live payment and refund smoke test

```sh
node scripts/testnet-smoke.mjs --execute
```

This performs real testnet writes. It creates persistent test-only buyer/merchant identities, funds the buyer with 2.5 USDT, pays 2 USDT through the deployed checkout, exercises a separate booking server's outage/recovery, and refunds 0.5 USDT. The relayer pays gas. The API and merchant HTTP services run locally; settlement occurs on public Whitechain Sepolia.

The funding transaction is journaled and reused on restart. The checkout and refund IDs are stable, preventing repeat payments on a successful rerun. If an authorization has expired or a job has failed, investigate the recorded state rather than deleting the database. The script exits with its services stopped and keeps evidence and credentials under `.local/live-proof/`. The published result contains public addresses and receipts only.

## Incident handling

- `BROADCAST_UNCERTAIN`: inspect the recorded transaction hash and relayer nonce. Restarting rebroadcasts the same raw bytes. Automatic fee replacement is not implemented.
- `CHAIN_REVIEW_REQUIRED`: stop customer submissions, compare checkpoint/event hashes with the canonical chain, and reconcile affected orders and merchant fulfillment. Do not clear the halted flag without that review.
- Repeated HTTP failures: inspect merchant delivery history, restore the receiver, and replay using the merchant retry endpoint. Keep the receiver idempotent.
- `MERCHANT_GAS_BUDGET`: review the merchant's reservations and expected volume before changing its configured limit. Reservations cap estimated execution fees, not all chain data fees.
- Before backup, use SQLite's supported online backup facilities or stop writers and capture the database consistently. Copying only the main file while WAL writes are active can lose recent state.

Public hosting additionally requires TLS, managed secrets and backups, a reviewed webhook egress policy, explicit trusted-proxy configuration, metrics/alerts, and deployment-specific rate limiting. The current code has not undergone an independent security audit.

## Local browser demo

Provision a merchant first, with a webhook that reaches the booking service on port 4301. The database and merchant credentials must describe the same merchant. Set these paths to your own local files:

```sh
DB_PATH=.local/demo.sqlite \
DEMO_MERCHANT_ID=your-demo-merchant \
MERCHANT_CONFIG=.local/merchant.json \
BOOKING_DB=.local/bookings.sqlite \
DEMO_PRICE=100000 \
DEMO_WORKER=0 pnpm demo
```

Run `pnpm dev:web` separately and open `http://127.0.0.1:4210/demo`. This example starts with submission paused. Set `DEMO_WORKER=1` only when ready to process queued work and spend testnet gas. The supervisor starts API, booking receiver and, when enabled, worker; stopping it stops its children. `DEMO_PRICE` is a positive integer amount in token base units, defaulting to 2000000. Existing order amounts remain immutable when the configured price changes.

For an isolated fork, also set `LOCAL_FORK=1` and use that fork's deployment, relay wallet and merchant database. Browser signing requires a wallet configured for the same network endpoint. Never reuse a relay key across independent databases.

`DEMO_MERCHANT_ID` opts that merchant into public read-only demo data. Omit it from a private production deployment. Merchant sessions last seven days; the signature challenge lasts five minutes. Use the registered payout wallet to sign in at `/merchant`; refund execution requires another token authorization and sufficient USDT. A canceled refund signature can leave an unsigned reservation until its 15-minute deadline and worker cleanup.

Public hosting runs the Next.js application server and its same-origin API rewrites described in [frontend deployment](landing.md). Configure the production origin before login; origin checks deliberately reject mismatches.

## Recover an unbroadcast payment

The merchant workspace exposes **Retry original payment** only when the job failed before any transaction was signed or broadcast and its original authorization has not expired. The authenticated API is `POST /v1/merchant/orders/:id/retry-payment`; the SDK method is `retryPayment(checkoutId)`. Resolve the reported cause first. A retry uses the same job, amount, signer and signature. Paused workers, checkout scope and gas caps still apply.

Expired authorizations require a new checkout. Signed or broadcast transactions must be reconciled against their stored hash; this endpoint refuses them. Do not reset these jobs in SQL or send another transaction merely because a request timed out.

For an exhausted merchant allowance, an operator can review a proposed change without modifying the database:

```sh
DB_PATH=/data/checkout.sqlite node scripts/set-merchant-budget.mjs MERCHANT_ID 10000000000000000
# Apply the reviewed value:
DB_PATH=/data/checkout.sqlite node scripts/set-merchant-budget.mjs MERCHANT_ID 10000000000000000 --apply
```

The command requires an explicit database path, refuses unknown merchants and allowances above the configured global cap, and prints only the merchant ID and budget values. It does not submit transactions or retry jobs. Back up the database before deploying a schema migration. Schema version 4 adds immutable order details without rewriting existing receipts.

### Unlimited gas sponsorship

`GLOBAL_DAILY_GAS_BUDGET`, `REGISTRATION_DAILY_GAS_BUDGET`, and `MAX_GAS_PER_JOB` accept `unlimited` as an explicit alternative to a wei amount. Existing merchants retain their stored budget until updated with `set-merchant-budget.mjs MERCHANT_ID unlimited --apply`. Gas reservations remain recorded for accounting even when caps are disabled. Disabling a merchant cap does not disable a finite global cap. Unlimited sponsorship still requires sufficient WBT in the relay wallet.
