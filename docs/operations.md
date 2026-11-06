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

`node scripts/verify-testnet.mjs` submits that preserved input to the explorer. An accepted verification request still needs an explorer result before the deployment can be described as verified. At the recorded run, the explorer returned 403 with verification temporarily unavailable.

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
