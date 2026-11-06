const messages: Record<string, string> = {
  PAYMENT_NOT_RETRYABLE:
    'This payment cannot be safely retried. Check its receipt and authorization expiry.',
  AUTHORIZATION_EXPIRED:
    'The authorization expired. Ask the customer to create a new order; do not reuse the old signature.',
  TRANSACTION_REVIEW_REQUIRED:
    'A transaction was already signed or broadcast. The operator must reconcile its chain status before taking action.',
  REFUND_UNAVAILABLE:
    'This refund request is cancelled, expired or failed. Review the current refund balance before creating another.',
  REFUND_NOT_CANCELLABLE:
    'This refund has already been submitted and cannot be cancelled.',
  TRANSACTION_GAS_CAP:
    'The estimated network fee exceeds the per-transaction cap. Wait for lower fees or contact the operator.',
  RELAY_SCOPE_RESTRICTED:
    'Payment processing is currently limited to a selected checkout. No transaction was submitted.',
  REGISTRATION_DISABLED:
    'New merchant registration is not enabled on this deployment yet.',
  MERCHANT_ALREADY_REGISTERED:
    'This payout wallet already has an account. Sign in to continue.',
  INTEGRATION_NOT_READY:
    'Connect and check your notification endpoint in merchant settings before creating a checkout.',
  PUBLIC_HTTPS_WEBHOOK_REQUIRED:
    'Use a public HTTPS notification URL on port 443, without credentials or a fragment.',
  WEBHOOK_NOT_CONFIGURED:
    'Save a notification endpoint before checking the connection.',
  WEBHOOK_CHECK_COOLDOWN:
    'Wait 30 seconds before checking the connection again.',
  SETTINGS_CHANGED:
    'Settings changed during the connection check. Check the current endpoint again.',
  GLOBAL_GAS_BUDGET:
    'The shared relay budget has been reached. Contact the operator before retrying.',

  RELAYER_PAUSED:
    'Payments are temporarily paused. No payment or refund was submitted.',
  SIGN_IN_REQUIRED: 'Connect your registered merchant wallet to continue.',
  MERCHANT_NOT_REGISTERED:
    'This wallet has no merchant account. Select Create account, or switch to your registered payout wallet.',
  INVALID_SIGNATURE: 'The signature could not be verified. Please try again.',
  CHALLENGE_EXPIRED: 'The sign-in request expired. Please connect again.',
  CHECKOUT_EXPIRED:
    'This checkout expired. Start a new order with the merchant.',
  CHECKOUT_UNAVAILABLE:
    'This checkout is no longer available for a new payment.',
  SELF_PAYMENT: 'Use a buyer wallet different from the merchant wallet.',
  OVER_REFUND: 'That amount exceeds the remaining refundable balance.',
  RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
  MERCHANT_GAS_BUDGET:
    'The merchant gas allowance was reached before broadcasting. Ask the operator to review the allowance, then retry while the authorization is valid.',
  TRANSACTION_REVERTED:
    'The transaction did not complete. Check your wallet balance and contact the merchant.',
  SIMULATION_REVERTED:
    'The payment could not be submitted. Check the USDT balance and payment authorization.',
  CHAIN_REVIEW_REQUIRED:
    'Payments are paused while the network record is reviewed.',
  REFUND_EXPIRED:
    'The refund authorization expired. Create a new refund request.',
  DEMO_UNAVAILABLE: 'The workspace preview is not available on this server.',
};
async function request<T>(path: string, body?: unknown): Promise<T> {
  let response;
  try {
    response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw Error(
      'We could not reach Checkout. Refresh to check the latest status. If you just submitted a payment or refund, check its receipt before retrying.',
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code =
      typeof result.error === 'string' ? result.error : result.error?.code;
    throw Object.assign(
      Error(
        messages[code ?? ''] ??
          'The request could not be completed. Please try again.',
      ),
      { code, status: response.status },
    );
  }
  return result as T;
}
// Coalesce simultaneous reads only; never retain account or payment responses.
const reads = new Map<string, Promise<unknown>>();
export function api<T>(path: string, body?: unknown): Promise<T> {
  if (body !== undefined) {
    reads.clear();
    return request<T>(path, body);
  }
  const existing = reads.get(path);
  if (existing) return existing as Promise<T>;
  const pending = request<T>(path).finally(() => {
    if (reads.get(path) === pending) reads.delete(path);
  });
  reads.set(path, pending);
  return pending;
}
export const explainCode = (code: string | null | undefined) =>
  messages[code ?? ''] ??
  'The payment needs attention. Please contact the merchant before trying again.';
export const shortAddress = (address: string | null | undefined) =>
  address ? address.slice(0, 6) + '...' + address.slice(-4) : 'Not connected';
export function escapeHtml(value: unknown) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      (
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        }) as Record<string, string>
      )[c],
  );
}
export function money(value: string | bigint | null | undefined) {
  const units = BigInt(value ?? '0');
  const fraction = (units % 1000000n)
    .toString()
    .padStart(6, '0')
    .replace(/0+$/, '');
  return (
    (units / 1000000n).toLocaleString('en') + (fraction ? '.' + fraction : '')
  );
}
export const orderLabel = (id: string) =>
  /^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(id)
    ? 'ORD-' + id.slice(0, 8).toUpperCase()
    : id;
export const transactionLink = (hash: string | null | undefined) =>
  /^0x[a-fA-F0-9]{64}$/.test(hash ?? '')
    ? `https://explorer.testnet.whitechain.io/tx/${hash}`
    : null;

export const errorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : 'The request could not be completed.';
export const errorStatus = (error: unknown): number | undefined =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  typeof error.status === 'number'
    ? error.status
    : undefined;
