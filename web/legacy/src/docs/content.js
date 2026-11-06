export const pages = [
  {
    slug: 'overview',
    group: 'Start here',
    title: 'Build payments into your product',
    label: 'Introduction',
    description:
      'Accept USDT, track fulfillment, and recover the handoff between a payment and an order.',
    sections: [
      {
        title: 'One payment, a complete record',
        text: 'Your server creates an order with a fixed price. The customer signs a token authorization, and the relayer pays gas to settle USDT directly to your payout wallet. Confirmed chain events create a receipt and a signed notification for your server.',
      },
      {
        title: 'Keep fulfillment separate',
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
        title: '1. Prepare your account',
        text: 'You need an operator-provisioned merchant, a payout wallet, an HTTPS webhook endpoint and the API key saved during provisioning. Merchant self-service signup is not available yet. The operator must configure CHECKOUT_BASE_URL so created orders include checkout URLs.',
        link: {
          href: '/docs/authentication',
          label: 'Account setup and authentication',
        },
      },
      {
        title: '2. Use the server SDK',
        text: 'The SDK ships in this repository at sdk/server.mjs; it is not published as an npm package. The import below assumes your integration file is at the repository root. Set CHECKOUT_API to your API origin and CHECKOUT_API_KEY to your merchant credential.',
        code: `import { checkoutClient } from './sdk/server.mjs';

const checkout = checkoutClient({
  baseUrl: process.env.CHECKOUT_API,
  apiKey: process.env.CHECKOUT_API_KEY,
});

const order = await checkout.create({
  orderId: 'booking-1042',
  amount: '2000000', // 2 USDT, six decimals
});

if (!order.checkoutUrl) {
  throw new Error('Configure CHECKOUT_BASE_URL on the API');
}
// Redirect your customer to order.checkoutUrl.`,
        language: 'JavaScript',
      },
      {
        title: '3. Receive confirmation',
        text: 'Verify the webhook signature against the exact raw request body. Persist the event and business operation idempotently before responding successfully. Then acknowledge fulfillment using the checkout UUID, not your external order ID.',
        code: `await checkout.fulfill(checkoutId, 'fulfilled');`,
        language: 'JavaScript',
        link: {
          href: '/docs/webhooks',
          label: 'Implement payment notifications',
        },
      },
      {
        title: '4. Verify the result',
        text: 'Open the receipt URL and confirm both payment and fulfillment. The merchant workspace shows delivery attempts and transaction history. A queued API response is not payment confirmation. Use a separate buyer wallet from the merchant payout wallet.',
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
        title: 'Register a merchant',
        text: 'An operator runs the following from a configured service checkout. DB_PATH must point to the database used by the API. Replace the address and endpoint arguments with the merchant payout wallet and reviewed HTTPS webhook URL. The script checks the configured chain and deployment before registration.',
        code: `DB_PATH=.local/service.sqlite node scripts/create-merchant.mjs \\
  YOUR_PUBLIC_PAYOUT_ADDRESS \\
  https://your-business.example/webhook`,
        language: 'Shell',
      },
      {
        title: 'Credentials stay on the server',
        text: 'The script generates a merchant ID, API key and webhook secret and saves them in .local/merchant-testnet.json with file mode 0600. It refuses to overwrite that file. Multi-merchant credential management and key rotation still need operator tooling. Never place these credentials in frontend environment variables.',
        code: `Authorization: Bearer <merchant API key>`,
        language: 'HTTP',
      },
      {
        title: 'Sign in with your payout wallet',
        text: 'Open /merchant and connect the registered payout wallet. The application requests a five-minute, single-use challenge and verifies the wallet signature. A successful login creates a seven-day HttpOnly, SameSite=Strict cookie, marked Secure over HTTPS. Logout revokes it. Login does not authorize a payment or refund.',
      },
      {
        title: 'Origin and access rules',
        text: 'Cookie-authenticated mutations require an Origin header matching APP_ORIGIN exactly. Server integrations use bearer credentials. Orders, deliveries and refunds are scoped to the authenticated merchant. An unregistered wallet receives MERCHANT_NOT_REGISTERED; connecting a wallet alone does not create a merchant account.',
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
        code: `{
  "orderId": "booking-1042",
  "amount": "2000000",
  "expiresIn": 900
}`,
        language: 'JSON',
      },
      {
        title: 'Retries and immutable pricing',
        text: 'Reusing an orderId for the same merchant returns the existing checkout when its amount matches. A different amount returns a conflict. Keep the original ID when a request times out; creating a fresh ID could create another order. Prices belong on your server, never in a trusted browser field.',
      },
      {
        title: 'Authorize and submit',
        text: 'The bundled checkout handles signing. A custom client calls POST /v1/checkouts/:id/authorization with {payer}, signs the returned EIP-712 typed data, then calls POST /v1/checkouts/:id/pay with {payer, signature}. Verify the chain, token, recipient, amount and deadline before signing. The EIP-3009 nonce binds the checkout terms. The relayer pays gas.',
      },
      {
        title: 'Read the receipt',
        text: 'GET /v1/checkouts/:id returns amount, merchant, buyer, state, refunded, fulfillment, expiresAt, chainId, token, paymentJob and timeline. The checkout UUID grants receipt access: do not encode private customer information in the external order ID.',
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
        title: 'Verify the raw body',
        text: 'Notifications include x-checkout-timestamp and x-checkout-signature headers. The signature is hex HMAC-SHA256 over timestamp + "." + rawBody. The SDK rejects timestamps outside a five-minute window. Verify before JSON parsing or business processing. Do not stringify a parsed object to reconstruct the body.',
        code: `import { verifyWebhook } from './sdk/server.mjs';

const valid = verifyWebhook(
  process.env.CHECKOUT_WEBHOOK_SECRET,
  timestampHeader,
  rawBody,
  signatureHeader,
);
if (!valid) {
  // Respond with 401 before processing the event.
}`,
        language: 'JavaScript',
      },
      {
        title: 'Event fields',
        text: 'Both payment.confirmed and refund.confirmed contain these fields. amount is the amount for this event, not the cumulative refund total.',
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
        title: 'Reserve the amount',
        text: 'Use a stable refundId for each refund. The server checks confirmed refunds and pending reservations against the original payment. Reusing that ID with another amount returns REFUND_CONFLICT.',
        code: `const refund = await checkout.refund({
  checkoutId,
  refundId: 'return-1042-1',
  amount: '500000', // 0.5 USDT
});`,
        language: 'JavaScript',
      },
      {
        title: 'Get the merchant signature',
        text: 'Have the registered payout wallet sign refund.authorization using EIP-712. JSON numeric strings may need conversion to BigInt for the wallet client. The bundled wallet module validates the token, chain, recipient and amount before requesting a signature. Merchant credentials and login do not authorize token movement.',
        link: {
          href: 'https://github.com/Allen-Saji/whitechain-checkout/blob/main/web/src/app/wallet.js',
          label: 'Inspect the wallet signing implementation',
        },
      },
      {
        title: 'Submit and confirm',
        code: `await checkout.submitRefund(refund.id, signature);
// Poll GET /v1/checkouts/:id for the confirmed refund.`,
        language: 'JavaScript',
        text: 'The signature comes from the merchant wallet. A queued response does not mean funds have returned. Wait for the Refunded receipt event or refund.confirmed notification. The merchant needs sufficient USDT; the relayer pays gas.',
      },
      {
        title: 'Reservations and limits',
        text: 'Unsigned reservations expire after 15 minutes and are released by the worker. Closing a signature prompt does not immediately release a reservation. The contract caps cumulative refunds at the original payment, but it cannot force a merchant to authorize a refund or retain enough funds. Refunds remain possible during the contract payment pause; the application worker pause suspends submission for both.',
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
            '{orderId, amount, expiresIn?}; create or reuse an order.',
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
        code: `{
  "error": {
    "code": "INVALID_INPUT"
  }
}`,
        language: 'JSON',
        link: { href: '/docs/errors', label: 'Error handling and recovery' },
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
            'Ask the operator to provision the payout address.',
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
      {
        title: 'Operator responsibilities',
        text: 'Run the API, worker and merchant receiver against the intended database and deployment. Monitor relayer WBT, failed notifications, stalled jobs and checkpoint health. Stuck transactions currently need manual investigation; automatic fee replacement and reorg rollback are not implemented.',
        link: {
          href: 'https://github.com/Allen-Saji/whitechain-checkout/blob/main/docs/operations.md',
          label: 'Operations and deployment guide',
        },
      },
    ],
  },
];
