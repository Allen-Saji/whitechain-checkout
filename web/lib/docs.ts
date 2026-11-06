export interface DocSection {
  title: string;
  text?: string;
  code?: string;
  language?: string;
  rows?: [string, string][];
  link?: { href: string; label: string };
}
export interface DocPage {
  slug: string;
  group: string;
  title: string;
  label: string;
  description: string;
  sections: DocSection[];
}
export const pages: DocPage[] = [
  {
    slug: 'overview',
    group: 'Start here',
    title: 'Build payments into your product',
    label: 'Introduction',
    description:
      'Add hosted USDT payments to your app, then track orders and refunds from your workspace.',
    sections: [
      {
        title: 'How a payment works',
        text: 'Your server creates an order with a fixed price. The customer signs a token authorization, and the relayer pays gas to settle USDT directly to your payout wallet. Confirmed chain events create a receipt and a signed notification for your server.',
      },
      {
        title: 'Payment and fulfillment',
        text: 'Payment confirmation means funds have moved. Fulfillment means your application completed the order. A successful webhook response stops delivery retries; your server separately acknowledges fulfillment. This distinction makes a paid but undelivered order visible.',
      },
      {
        title: 'What you integrate',
        rows: [
          [
            'Server SDK',
            'Create checkouts, acknowledge fulfillment and request refunds.',
          ],
          [
            'Hosted checkout UI',
            'Wallet selection, payment authorization and receipts.',
          ],
          [
            'Merchant workspace',
            'Orders, notification history, retries and partial refunds.',
          ],
          [
            'Webhook receiver',
            'Your server verifies each event and fulfills each order once.',
          ],
        ],
      },
      {
        title: 'Current network',
        text: 'The configured deployment is Whitechain Sepolia, chain 1874, using USDT at 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 (six decimals). Use test assets for this deployment. Mainnet deployment, ERC-1271 contract wallets and embedded wallet onboarding are not implemented.',
      },
      {
        title: 'Start with a payment link',
        text: 'Create an account, connect your webhook and call the hosted API. You do not need to run the Checkout backend.',
        link: {
          href: '/docs/quickstart',
          label: 'Follow the quickstart',
        },
      },
    ],
  },
  {
    slug: 'quickstart',
    group: 'Start here',
    title: 'Create your first checkout',
    label: 'Quickstart',
    description:
      'Connect your server, set an amount, and send a customer to checkout.',
    sections: [
      {
        title: '1. Create your merchant account',
        text: 'Choose a business name and connect the wallet that will receive payments. Sign the registration message, then save your API key and webhook signing secret in your server environment. Signing in does not move funds.',
        link: {
          href: '/register',
          label: 'Create account',
        },
      },
      {
        title: '2. Connect your webhook',
        text: 'Add a public HTTPS route to your app that verifies Checkout signatures. It must accept integration.check events with a 2xx response without creating an order. Save its URL in Integration settings, then select Send connection check. Checkout creation becomes available after the check passes.',
        link: {
          href: '/docs/webhooks',
          label: 'Build your webhook receiver',
        },
      },
      {
        title: '3. Create a payment link',
        text: 'Run this request from your server or terminal with CHECKOUT_API_KEY set to your merchant API key. The hosted API is available at https://checkout.allensaji.dev. Amounts use six decimals: 100000 means 0.10 USDT. No SDK installation is needed for this request.',
        language: 'Shell',
        code: 'curl --fail-with-body https://checkout.allensaji.dev/v1/checkouts \\\n  -H "Authorization: Bearer $CHECKOUT_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  --data \'{"orderId":"workshop-001","title":"Studio workshop","amount":"100000"}\'',
      },
      {
        title: '4. Open the checkout',
        text: 'Open checkoutUrl from the response. Use a buyer wallet different from your payout wallet, with the required USDT on Whitechain Sepolia. Connect the wallet and authorize the displayed amount. Checkout covers the network fee. If payment processing is paused, you can inspect the checkout but cannot complete a new payment.',
      },
      {
        title: '5. Complete the order',
        text: 'Your receiver gets payment.confirmed after settlement. Match the event to the order you stored, complete the purchase once, then acknowledge fulfillment using checkoutId from the event. Return 2xx only after saving the event or completing durable processing. A timeout is not proof that payment failed.',
        link: {
          href: '/docs/webhooks',
          label: 'Handle confirmation and fulfillment',
        },
      },
      {
        title: 'Use the TypeScript SDK',
        text: 'The SDK wraps the same API and includes webhook verification. Install it from the source package, then use it in your server app.',
        link: {
          href: '/docs/agents',
          label: 'SDK installation and coding-agent guide',
        },
      },
    ],
  },
  {
    slug: 'authentication',
    group: 'Start here',
    title: 'Accounts and authentication',
    label: 'Authentication',
    description:
      'Use API keys on your server and wallet sessions in the merchant workspace.',
    sections: [
      {
        title: 'Create your account',
        text: 'Enter your business name and connect your payout wallet. Sign the registration message to create your account. Save the API key and webhook signing secret when they appear; you cannot reveal them again later.',
        link: {
          href: '/register',
          label: 'Create merchant account',
        },
      },
      {
        title: 'Sign in to your workspace',
        text: 'Use the same payout wallet to sign in. Your session lasts seven days unless you sign out. The sign-in message expires after five minutes if you have not signed it; this is not the session duration. Sign-in does not authorize payments or refunds.',
        link: {
          href: '/merchant',
          label: 'Open workspace',
        },
      },
      {
        title: 'Authenticate server requests',
        text: 'Send your API key in the Authorization header. Keep it in your server environment, never in client-side JavaScript or a NEXT_PUBLIC variable. Use the separate webhook secret to verify incoming notifications.',
        language: 'HTTP',
        code: 'Authorization: Bearer <merchant API key>',
      },
      {
        title: 'Replace a lost credential',
        text: 'Open Integration settings to replace an API key or webhook secret. The previous value stops working immediately. Update your server configuration with the new value. After changing the webhook secret, run the connection check again.',
        link: {
          href: '/merchant/settings',
          label: 'Open integration settings',
        },
      },
      {
        title: 'Wallet sessions and account access',
        text: 'The browser uses an HttpOnly session cookie. Requests that change account settings must come from the configured Checkout origin. API keys access only their merchant account; credential rotation requires a signed-in wallet session.',
      },
    ],
  },
  {
    slug: 'checkouts',
    group: 'Integration',
    title: 'Checkouts and receipts',
    label: 'Accept a payment',
    description:
      'Create immutable orders and follow their confirmed payment state.',
    sections: [
      {
        title: 'Create an order',
        text: 'POST /v1/checkouts requires merchant authentication. orderId is a non-empty string of at most 120 characters. amount is a positive integer string in token base units. expiresIn is optional, defaults to 900 seconds and must be between 60 and 3600.',
        code: '{\n  "orderId": "workshop-001",\n  "title": "Studio workshop",\n  "description": "One workshop booking",\n  "amount": "100000",\n  "expiresIn": 900\n}',
        language: 'JSON',
      },
      {
        title: 'Retries and immutable pricing',
        text: 'Reusing an orderId for the same merchant returns the existing checkout only when its amount, title and description match. Changed terms return a conflict. Reuse the original ID after a request timeout. Derive prices from your server-side product data; do not trust an amount supplied by the browser.',
      },
      {
        title: 'Authorize and submit',
        text: 'The bundled checkout handles signing. A custom client calls POST /v1/checkouts/:id/authorization with {payer}, signs the returned EIP-712 typed data, then calls POST /v1/checkouts/:id/pay with {payer, signature}. Verify the chain, token, recipient, amount and deadline before signing. The EIP-3009 nonce binds the checkout terms. The relayer pays gas.',
      },
      {
        title: 'Read the receipt',
        text: 'GET /v1/checkouts/:id returns title, description, merchantName, amount, merchant, buyer, state, refunded, fulfillment, expiresAt, chainId, token, paymentJob and timeline. The checkout UUID grants receipt access: do not encode private customer information in the external order ID.',
        rows: [
          ['created', 'Waiting for a signed payment.'],
          ['queued', 'Submitted for processing; not yet confirmed.'],
          ['paid', 'Payment confirmed onchain.'],
          [
            'partially_refunded / refunded',
            'Confirmed refunds update the cumulative total.',
          ],
          ['fulfillment', 'Separate pending, fulfilled or unavailable state.'],
        ],
      },
      {
        title: 'Handle uncertainty',
        text: 'After a network error, read the existing receipt before asking the customer to sign again. The worker saves signed transaction bytes before broadcast and reuses those bytes after a restart. Expired or failed payments need a reviewed retry; a request timeout alone is not evidence of failure.',
      },
    ],
  },
  {
    slug: 'webhooks',
    group: 'Integration',
    title: 'Notifications and fulfillment',
    label: 'Webhooks',
    description:
      'Verify events, deduplicate work, and recover delivery after an outage.',
    sections: [
      {
        title: 'Before the connection check',
        text: 'Create a public HTTPS POST endpoint on your own server. Read the raw request body and verify the signature with your webhook secret. For integration.check, return 200 after verification; do not create or fulfill an order. Save this endpoint in Integration settings, then send the check.',
        link: {
          href: '/merchant/settings',
          label: 'Configure webhook URL',
        },
      },
      {
        title: 'Verify the raw body',
        text: 'Notifications include x-checkout-timestamp and x-checkout-signature headers. The signature is hex HMAC-SHA256 over timestamp + "." + rawBody. The SDK rejects timestamps outside a five-minute window. Verify before JSON parsing or business processing. Do not stringify a parsed object to reconstruct the body.',
        code: "import { verifyWebhook } from '@whitechain-checkout/server';\n\nconst valid = verifyWebhook(\n  process.env.CHECKOUT_WEBHOOK_SECRET,\n  timestampHeader,\n  rawBody,\n  signatureHeader,\n);\nif (!valid) {\n  // Respond with 401 before processing the event.\n}",
        language: 'JavaScript',
        link: {
          href: '/docs/agents',
          label: 'Install the SDK for signature verification',
        },
      },
      {
        title: 'Event fields',
        text: 'Both payment.confirmed and refund.confirmed contain these fields. The separate integration.check event contains id, type, merchantId and createdAt; verify its signature and return 2xx without fulfilling an order. amount is the amount for this event, not the cumulative refund total.',
        rows: [
          ['id', 'Stable event ID; use a unique constraint to deduplicate.'],
          ['type', 'payment.confirmed or refund.confirmed.'],
          ['checkoutId', 'Internal checkout UUID for fulfillment calls.'],
          ['orderId', 'Your original order reference.'],
          ['amount', 'Token base units as a string.'],
          ['transactionHash / chainId', 'Settlement reference and network.'],
        ],
      },
      {
        title: 'Persist, fulfill, acknowledge',
        text: 'Deliveries are at least once. Persist event handling and business fulfillment with durable uniqueness constraints. Respond with 2xx after durable acceptance. Call checkout.fulfill(event.checkoutId) after completing the order. If acknowledgement fails after business fulfillment, retry the acknowledgement without repeating the business operation.',
        link: {
          href: 'https://github.com/Allen-Saji/whitechain-checkout/blob/main/examples/booking/server.mjs',
          label: 'Read the durable booking implementation',
        },
      },
      {
        title: 'Retries and recovery',
        text: 'Failed HTTP deliveries are retried with the same event ID and a fresh timestamp/signature. A 2xx response stops automatic retries. Inspect GET /v1/merchant/deliveries or the workspace, then use POST /v1/merchant/deliveries/:id/retry to replay an event. Manual replay can duplicate a previously accepted event, so your receiver must remain idempotent.',
      },
    ],
  },
  {
    slug: 'refunds',
    group: 'Integration',
    title: 'Full and partial refunds',
    label: 'Refunds',
    description: 'Return funds with merchant consent and a verifiable receipt.',
    sections: [
      {
        title: 'Issue a refund from your workspace',
        text: 'Open an order and select Review refunds. Check the available amount, enter the amount to return, then select Review in wallet. Sign with your registered payout wallet. The receipt updates after confirmation. Your wallet must hold enough USDT to cover the refund.',
        link: {
          href: '/merchant',
          label: 'Open orders',
        },
      },
      {
        title: 'Reserve the amount',
        text: 'Use a stable refundId for each refund. The server checks confirmed refunds and pending reservations against the original payment. Reusing that ID with another amount returns REFUND_CONFLICT.',
        code: "const refund = await checkout.refund({\n  checkoutId,\n  refundId: 'return-1042-1',\n  amount: '500000', // 0.5 USDT\n});",
        language: 'JavaScript',
      },
      {
        title: 'Get the merchant signature',
        text: 'Have the registered payout wallet sign refund.authorization using EIP-712. JSON numeric strings may need conversion to BigInt for the wallet client. The bundled wallet module validates the token, chain, recipient and amount before requesting a signature. Merchant credentials and login do not authorize token movement.',
        link: {
          href: 'https://github.com/Allen-Saji/whitechain-checkout/blob/main/web/lib/wallet.ts',
          label: 'Inspect the wallet signing implementation',
        },
      },
      {
        title: 'Submit and confirm',
        code: 'await checkout.submitRefund(refund.id, signature);\n// Poll GET /v1/checkouts/:id for the confirmed refund.',
        language: 'JavaScript',
        text: 'The signature comes from the merchant wallet. A queued response does not mean funds have returned. Wait for the Refunded receipt event or refund.confirmed notification. The merchant needs sufficient USDT; the relayer pays gas.',
      },
      {
        title: 'Reservations and limits',
        text: 'Unsigned reservations expire after 15 minutes, including while the worker is paused. GET /v1/merchant/orders/:id/refunds reports reservations and available balance. POST /v1/merchant/refunds/:id/cancel releases an unsubmitted reservation; queued refunds cannot be cancelled. Closing a signature prompt does not immediately release a reservation. The contract caps cumulative refunds at the original payment, but it cannot force a merchant to authorize a refund or retain enough funds. Refunds remain possible during the contract payment pause; the application worker pause suspends submission for both.',
      },
    ],
  },
  {
    slug: 'agents',
    group: 'Integration',
    title: 'Integrate with your coding agent',
    label: 'Agents and SDK',
    description:
      'Install the server SDK into an existing app, with a focused integration skill and machine-readable reference.',
    sections: [
      {
        title: 'Install from source',
        text: 'The SDK is packaged with TypeScript declarations and no runtime dependencies. It is not published to the npm registry. Clone the repository, pack sdk/, and install that tarball in your server application.',
        language: 'sh',
        code: 'git clone https://github.com/Allen-Saji/whitechain-checkout.git\ncd whitechain-checkout\nnpm pack ./sdk\n\n# From your application directory, install the generated file:\nnpm install /absolute/path/to/whitechain-checkout/whitechain-checkout-server-0.1.0.tgz',
      },
      {
        title: 'Create a checkout from your server',
        text: 'Set CHECKOUT_API to https://checkout.allensaji.dev and CHECKOUT_API_KEY to the key saved during registration. Use your own stored order reference and server-side price.',
        language: 'TypeScript',
        code: "import { checkoutClient } from '@whitechain-checkout/server';\n\nconst checkout = checkoutClient({\n  baseUrl: process.env.CHECKOUT_API!,\n  apiKey: process.env.CHECKOUT_API_KEY!,\n});\n\nconst order = await checkout.create({\n  orderId: 'workshop-001',\n  title: 'Studio workshop',\n  amount: '100000', // 0.10 USDT\n});\n// Send order.checkoutUrl to your customer.",
      },
      {
        title: 'Give your agent the integration skill',
        text: 'Give your coding agent the integration skill and review its changes. The guide covers server-side credentials, prices from your product database, signature checks and fulfillment tests.',
        link: {
          href: '/skill.md',
          label: 'Read the integration skill',
        },
      },
      {
        title: 'A concrete task to give your agent',
        language: 'text',
        code: 'Use https://checkout.allensaji.dev/skill.md to integrate Checkout into this app. Use our existing authentication and product database. Add server-side checkout creation, a signed webhook receiver, durable event deduplication and fulfillment acknowledgement. Use local tests first. Do not expose credentials or submit a public-chain transaction without approval.',
      },
      {
        title: 'Machine-readable references',
        rows: [
          [
            '/openapi.json',
            'Integration endpoint contract and authentication.',
          ],
          ['/llms.txt', 'Short resource index.'],
          [
            '/llms-full.txt',
            'Plain-text reference generated from these developer guides.',
          ],
          ['/skill.md', 'Focused integration instructions.'],
        ],
      },
      {
        title: 'Recover an order safely',
        text: 'POST /v1/merchant/orders/:id/retry-payment requeues the original failed payment only when no transaction was signed or broadcast and its authorization remains valid. Resolve the reported balance or budget issue first. Expired orders need a new checkout. The merchant workspace offers this action only for eligible jobs.',
      },
    ],
  },
  {
    slug: 'api',
    group: 'Reference',
    title: 'API reference',
    label: 'Endpoints',
    description:
      'JSON over HTTP. Amounts are integer strings in token base units.',
    sections: [
      {
        title: 'Merchant endpoints',
        rows: [
          [
            'POST /v1/checkouts',
            '{orderId, amount, title?, description?, expiresIn?}; create or reuse an order. Metadata and price are immutable.',
          ],
          [
            'GET /v1/merchant/orders',
            'Up to 100 recent orders for this merchant.',
          ],
          [
            'GET /v1/merchant/deliveries',
            'Up to 100 recent notifications for this merchant.',
          ],
          [
            'POST /v1/merchant/deliveries/:id/retry',
            '{}; requeue a notification.',
          ],
          [
            'POST /v1/merchant/orders/:id/fulfillment',
            '{state: "fulfilled" | "unavailable"}.',
          ],
          [
            'POST /v1/merchant/orders/:id/refunds',
            '{refundId, amount}; receive refund ID and typed authorization.',
          ],
          [
            'POST /v1/merchant/refunds/:id/submit',
            '{signature}; receive job ID and status.',
          ],
        ],
      },
      {
        title: 'Account and integration endpoints',
        text: 'Use the registration page to create an account. Settings and credential routes require the merchant wallet session; an API key alone cannot rotate credentials.',
        rows: [
          [
            'POST /v1/registration/challenge',
            '{address, businessName}; request an account registration message.',
          ],
          [
            'POST /v1/registration/verify',
            '{id, signature}; create the account and return one-time credentials.',
          ],
          [
            'GET /v1/merchant/settings',
            'Read profile and connection status; no secrets returned.',
          ],
          [
            'POST /v1/merchant/settings',
            '{businessName, webhookUrl}; save settings and reset verification.',
          ],
          [
            'POST /v1/merchant/webhook/check',
            '{}; send a signed integration.check event. Limited to once per 30 seconds.',
          ],
          [
            'POST /v1/merchant/credentials/rotate',
            '{credential: "apiKey" | "webhookSecret"}; replace and reveal a new credential once.',
          ],
        ],
      },
      {
        title: 'Buyer endpoints',
        rows: [
          ['GET /v1/config', 'Chain, token, router and relay availability.'],
          [
            'GET /v1/checkouts/:id',
            'Public receipt accessed with its checkout UUID.',
          ],
          [
            'POST /v1/checkouts/:id/authorization',
            '{payer}; receive EIP-712 typed authorization.',
          ],
          ['POST /v1/checkouts/:id/pay', '{payer, signature}; queue payment.'],
        ],
      },
      {
        title: 'Wallet sessions',
        rows: [
          [
            'POST /v1/session/challenge',
            '{address}; receive id, message and expiresAt.',
          ],
          [
            'POST /v1/session/verify',
            '{id, signature}; set a merchant session cookie.',
          ],
          ['GET /v1/session', 'Read the current merchant session.'],
          [
            'POST /v1/session/logout',
            '{}; revoke the session and expire the cookie.',
          ],
        ],
      },
      {
        title: 'Error format',
        text: 'Validation errors return INVALID_INPUT. Requests are limited to 120 per minute per IP in each API process; a 429 response includes Retry-After. Limits are not shared across processes.',
        code: '{\n  "error": {\n    "code": "INVALID_INPUT"\n  }\n}',
        language: 'JSON',
        link: {
          href: '/docs/errors',
          label: 'Error handling and recovery',
        },
      },
    ],
  },
  {
    slug: 'errors',
    group: 'Reference',
    title: 'Errors and recovery',
    label: 'Errors',
    description:
      'Resolve the cause, preserve order identity, and check the receipt before retrying.',
    sections: [
      {
        title: 'Authentication',
        rows: [
          [
            'SIGN_IN_REQUIRED',
            'Sign in or supply a valid merchant bearer key.',
          ],
          [
            'MERCHANT_NOT_REGISTERED',
            'Create an account with this wallet at /register, or sign in with an already registered payout wallet.',
          ],
          ['CHALLENGE_EXPIRED', 'Request and sign a new login challenge.'],
          [
            'ORIGIN_NOT_ALLOWED',
            'Match APP_ORIGIN to the exact browser origin.',
          ],
          [
            'INVALID_SIGNATURE',
            'Check the wallet, message, network and authorization fields.',
          ],
        ],
      },
      {
        title: 'Payments and refunds',
        rows: [
          [
            'RELAYER_PAUSED',
            'Submission is disabled; existing receipts remain readable.',
          ],
          [
            'CHECKOUT_EXPIRED',
            'The authorization window ended. Review status before creating a new order.',
          ],
          [
            'OVER_REFUND',
            'Confirmed refunds plus pending reservations exceed the original payment.',
          ],
          [
            'REFUND_EXPIRED',
            'The reserved authorization expired; review before creating a new request.',
          ],
          [
            'MERCHANT_GAS_BUDGET',
            'Operator review is needed for the merchant execution-gas budget.',
          ],
          [
            'CHAIN_REVIEW_REQUIRED',
            'Processing halted after a chain checkpoint mismatch. Operator reconciliation is required.',
          ],
        ],
      },
    ],
  },
  {
    slug: 'self-hosting',
    group: 'Operations',
    title: 'Run your own Checkout deployment',
    label: 'Self-hosting',
    description:
      'For teams operating the API, worker and frontend. Merchants using the hosted service can follow the quickstart.',
    sections: [
      {
        title: 'Service setup',
        text: 'Run the API and worker against the same database and deployment. Configure APP_ORIGIN and CHECKOUT_BASE_URL for your frontend. Your separate merchant application stores its own API key and webhook secret.',
        link: {
          href: 'https://github.com/Allen-Saji/whitechain-checkout/blob/main/docs/getting-started.md',
          label: 'Repository setup guide',
        },
      },
      {
        title: 'Provision a merchant from the CLI',
        text: 'Run this only from your configured backend checkout, with DB_PATH pointing to the API database. The command requires deployment configuration and writes credentials to .local/merchant-testnet.json. It refuses to overwrite an existing file. Hosted merchants should register in the browser instead.',
        language: 'Shell',
        code: 'DB_PATH=.local/service.sqlite node scripts/create-merchant.mjs \\\n  YOUR_PUBLIC_PAYOUT_ADDRESS \\\n  https://your-business.example/webhook',
      },
      {
        title: 'Monitor processing',
        text: 'Monitor relayer WBT, gas budgets, failed notifications, stalled jobs and chain checkpoints. A paused worker stops payment/refund submission and notification processing. Automatic fee replacement and reorg rollback are not implemented.',
        link: {
          href: 'https://github.com/Allen-Saji/whitechain-checkout/blob/main/docs/operations.md',
          label: 'Operations guide',
        },
      },
    ],
  },
];
