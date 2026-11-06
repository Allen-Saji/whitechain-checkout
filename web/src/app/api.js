const messages = {
  RELAYER_PAUSED:
    'The demo relayer is paused. No payment or refund was submitted.',
  SIGN_IN_REQUIRED: 'Connect your registered merchant wallet to continue.',
  MERCHANT_NOT_REGISTERED:
    'This wallet is not registered as a merchant. You can still explore the read-only demo.',
  INVALID_SIGNATURE: 'The signature could not be verified. Please try again.',
  CHALLENGE_EXPIRED: 'The sign-in request expired. Please connect again.',
  CHECKOUT_EXPIRED:
    'This checkout expired. Start a new order from the workshop page.',
  CHECKOUT_UNAVAILABLE:
    'This checkout is no longer available for a new payment.',
  SELF_PAYMENT: 'Use a buyer wallet different from the merchant wallet.',
  OVER_REFUND: 'That amount exceeds the remaining refundable balance.',
  RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
  MERCHANT_GAS_BUDGET:
    'The merchant gas budget is exhausted. No payment was submitted.',
  TRANSACTION_REVERTED:
    'The transaction did not complete. Check your wallet balance and contact the merchant.',
  SIMULATION_REVERTED:
    'The payment could not be submitted. Check the USDT balance and payment authorization.',
  CHAIN_REVIEW_REQUIRED:
    'Payments are paused while the network record is reviewed.',
  REFUND_EXPIRED:
    'The refund authorization expired. Create a new refund request.',
  DEMO_UNAVAILABLE: 'The demo merchant is not configured on this server.',
};
export async function api(path, body) {
  let response;
  try {
    response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw Error(
      'We could not reach the service. Your order is not lost; refresh to check its status before trying again.',
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code =
      typeof result.error === 'string' ? result.error : result.error?.code;
    throw Object.assign(
      Error(
        messages[code] ??
          'The request could not be completed. Please try again.',
      ),
      { code, status: response.status },
    );
  }
  return result;
}
export const explainCode = (code) =>
  messages[code] ??
  'The payment needs attention. Please contact the merchant before trying again.';
export const shortAddress = (address) =>
  address ? address.slice(0, 6) + '...' + address.slice(-4) : 'Not connected';
export function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
}
export function money(value) {
  const units = BigInt(value ?? '0');
  const fraction = (units % 1000000n)
    .toString()
    .padStart(6, '0')
    .replace(/0+$/, '');
  return (
    (units / 1000000n).toLocaleString('en') + (fraction ? '.' + fraction : '')
  );
}
export const orderLabel = (id) =>
  /^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(id)
    ? 'WK-' + id.slice(0, 8).toUpperCase()
    : id;
export function showError(error) {
  const region = document.querySelector('#app-message');
  region.textContent = error.message ?? String(error);
  region.hidden = false;
}
export function clearError() {
  document.querySelector('#app-message').hidden = true;
}
export function busy(button, label) {
  const previous = button.textContent;
  button.disabled = true;
  button.textContent = label;
  return () => {
    button.disabled = false;
    button.textContent = previous;
  };
}
export const transactionLink = (hash) =>
  /^0x[a-fA-F0-9]{64}$/.test(hash ?? '')
    ? `https://explorer.testnet.whitechain.io/tx/${hash}`
    : null;
