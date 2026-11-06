import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';

export function publicAddress(address) {
  try {
    const ip = ipaddr.parse(address);
    return ip.range() === 'unicast';
  } catch {
    return false;
  }
}
export function webhookUrl(
  input,
  { local = false, trustedLoopbackOrigin } = {},
) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw Error('INVALID_WEBHOOK_URL');
  }
  if (url.username || url.password || url.hash || url.href.length > 2000)
    throw Error('INVALID_WEBHOOK_URL');
  const loopback =
    url.protocol === 'http:' &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (loopback && (local || url.origin === trustedLoopbackOrigin)) return url;
  if (url.protocol !== 'https:' || (url.port && url.port !== '443'))
    throw Error('PUBLIC_HTTPS_WEBHOOK_REQUIRED');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname) && !publicAddress(hostname))
    throw Error('PRIVATE_WEBHOOK_ADDRESS');
  return url;
}
export async function resolveWebhookTarget(input, options = {}) {
  const url = webhookUrl(input, options),
    hostname = url.hostname.replace(/^\[|\]$/g, '');
  const resolver = options.resolver ?? lookup;
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolver(hostname, { all: true, verbatim: true });
  const trusted =
    url.protocol === 'http:' &&
    (options.local || url.origin === options.trustedLoopbackOrigin);
  if (
    !addresses.length ||
    addresses.some((entry) =>
      trusted
        ? !['127.0.0.1', '::1'].includes(entry.address)
        : !publicAddress(entry.address),
    )
  )
    throw Error('PRIVATE_WEBHOOK_ADDRESS');
  return { url, address: addresses[0] };
}
export function createWebhookFetcher(options = {}) {
  return async (input, init) => {
    const signal = AbortSignal.any([
      init.signal ?? new AbortController().signal,
      AbortSignal.timeout(5000),
    ]);
    signal.throwIfAborted();
    let onAbort;
    const target = await Promise.race([
      resolveWebhookTarget(input, options),
      new Promise((_, reject) => {
        onAbort = () => reject(Error('WEBHOOK_TIMEOUT'));
        signal.addEventListener('abort', onAbort, { once: true });
      }),
    ]).finally(() => signal.removeEventListener('abort', onAbort));
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const { url, address } = target;
      const request =
        options.request ??
        (url.protocol === 'https:' ? httpsRequest : httpRequest);
      const req = request(
        url,
        {
          method: 'POST',
          headers: init.headers,
          signal,
          agent: false,
          // Use the validated address for this connection, keeping the original TLS hostname.
          lookup: (_hostname, lookupOptions, callback) => {
            if (lookupOptions.all) callback(null, [address]);
            else callback(null, address.address, address.family);
          },
        },
        (response) => {
          const status = response.statusCode;
          response.destroy();
          // Never follow redirects, including redirects to another public endpoint.
          if (status >= 300 && status < 400)
            reject(Error('WEBHOOK_REDIRECT_REJECTED'));
          else resolve({ status, body: null });
        },
      );
      req.on('error', () => reject(Error('WEBHOOK_DELIVERY_FAILED')));
      req.end(init.body);
    });
  };
}
