export { verifyWebhook } from './webhooks.mjs';
/** Server-only client. Never expose the merchant API key in browser bundles. */
export function checkoutClient({ baseUrl, apiKey }) {
  async function request(path, body) {
    const response = await fetch(new URL(path, baseUrl), {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        authorization: 'Bearer ' + apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(
        Error(data.error?.code ?? 'CHECKOUT_REQUEST_FAILED'),
        {
          code: data.error?.code ?? 'CHECKOUT_REQUEST_FAILED',
          httpStatus: response.status,
        },
      );
    return data;
  }
  return {
    get: (id) => request('/v1/checkouts/' + encodeURIComponent(id)),
    retryPayment: (id) =>
      request(
        '/v1/merchant/orders/' + encodeURIComponent(id) + '/retry-payment',
        {},
      ),
    refunds: (id) =>
      request('/v1/merchant/orders/' + encodeURIComponent(id) + '/refunds'),
    cancelRefund: (id) =>
      request('/v1/merchant/refunds/' + encodeURIComponent(id) + '/cancel', {}),
    create: ({ orderId, amount, title, description, expiresIn }) =>
      request('/v1/checkouts', {
        orderId,
        amount,
        title,
        description,
        expiresIn,
      }),
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
