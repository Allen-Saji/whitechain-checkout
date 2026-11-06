export { verifyWebhook } from '../src/crypto.mjs';
/** Server-only client. Never expose the merchant API key in browser bundles. */
export function checkoutClient({ baseUrl, apiKey }) {
  async function request(path, body) {
    const response = await fetch(new URL(path, baseUrl), {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok)
      throw Error(data.error?.code ?? 'CHECKOUT_REQUEST_FAILED');
    return data;
  }
  return {
    create: ({ orderId, amount }) =>
      request('/v1/checkouts', { orderId, amount }),
    fulfill: (checkoutId, state = 'fulfilled') =>
      request(
        '/v1/merchant/orders/' +
          encodeURIComponent(checkoutId) +
          '/fulfillment',
        { state },
      ),
    refund: ({ checkoutId, refundId, amount }) =>
      request(
        '/v1/merchant/orders/' + encodeURIComponent(checkoutId) + '/refunds',
        { refundId, amount },
      ),
    submitRefund: (refundId, signature) =>
      request(
        '/v1/merchant/refunds/' + encodeURIComponent(refundId) + '/submit',
        { signature },
      ),
  };
}
