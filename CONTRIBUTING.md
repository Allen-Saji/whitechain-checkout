# Contributing

Start with the [architecture](docs/architecture.md) and [setup guide](docs/getting-started.md). Open an issue describing a concrete bug or proposed behavior before making a large change. Do not post credentials, private customer data or security exploit details in public issues.

## Development

```sh
pnpm install --frozen-lockfile
pnpm check
```

Run `pnpm test:fork` when changing contracts, worker persistence, payment accounting or recovery. The fork must identify as Anvil; these tests must never target public-chain funds. Keep evidence under ignored `.local/`.

Keep route modules focused on validation and application operations. Share authorization encoding through `src/protocol.mjs`. Use numbered migrations for schema changes, and do not rewrite existing migration semantics. Add regression coverage when changing a payment, authentication or persistence failure mode.

Use Conventional Commit subjects describing the concrete change. Keep changes scoped and include the problem, resulting behavior and checks run in the pull request. Update affected developer documentation. Maintain ASCII source text, accessible labels, keyboard operation and reduced-motion support.

## Scope and credentials

Never commit private keys, environment files, databases or customer payloads. Do not add frontend variables for merchant API keys or webhook secrets. Public examples must describe working APIs and distinguish configured network behavior from future capabilities.

The project-wide license is not selected yet. Resolve licensing with the repository owner before incorporating this code into another distributed project.
