# Security policy

Checkout moves tokens through signed authorizations and a permissioned relay. The current deployment is Whitechain Sepolia and has not undergone an independent security audit.

## Reporting

Do not disclose exploit details, keys or customer data in a public issue. Use GitHub private vulnerability reporting if the repository exposes a "Report a vulnerability" action. If it is unavailable, open a minimal issue asking the maintainer for a private reporting channel without including the vulnerability. No response-time guarantee is currently offered.

Include the affected revision, reproduction steps, impact and a minimal local or isolated-fork proof. Do not test against other users, public funds or third-party services without permission.

## Boundaries

- Merchant API keys and relay private keys belong on the server. Session token hashes are stored in SQLite; browser cookies are HttpOnly and origin-checked for mutations.
- The receipt UUID grants access to its public payment details. Do not include private customer information in external order IDs.
- The merchant controls paid funds. Refunds require merchant consent and sufficient balance.
- The worker halts on a changed chain checkpoint. Reconciliation and stuck-transaction handling are manual.
- Webhook delivery validates public IP ranges, pins the validated DNS address for each connection, rejects redirects and uses a five-second deadline. Registration requires an explicit deployment flag. Infrastructure egress controls remain recommended defense in depth.
- SQLite, its WAL and backups require restricted access. Production deployment needs TLS, managed secrets, monitoring and explicit proxy configuration.

See [architecture](docs/architecture.md) and [operations](docs/operations.md) for detailed trust and recovery boundaries.
