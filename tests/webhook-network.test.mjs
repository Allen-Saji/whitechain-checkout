import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  publicAddress,
  resolveWebhookTarget,
  createWebhookFetcher,
} from '../src/http/webhook.mjs';
test('webhook targets reject private, metadata, mapped, mixed DNS and non-HTTPS destinations', async () => {
  for (const ip of [
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '2001:db8::1',
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress('8.8.8.8'), true);
  for (const url of [
    'http://example.com/',
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://example.com:8443/',
    'https://user:pass@example.com/',
    'https://example.com/#fragment',
  ])
    await assert.rejects(() => resolveWebhookTarget(url));
  await assert.rejects(
    () =>
      resolveWebhookTarget('https://example.com/', {
        resolver: async () => [
          { address: '8.8.8.8', family: 4 },
          { address: '127.0.0.1', family: 4 },
        ],
      }),
    /PRIVATE_WEBHOOK_ADDRESS/,
  );
  await assert.rejects(() =>
    resolveWebhookTarget('http://localhost:4301/', {
      local: true,
      resolver: async () => [{ address: '8.8.8.8', family: 4 }],
    }),
  );
  assert.equal(
    (
      await resolveWebhookTarget('http://127.0.0.1:4301/', {
        trustedLoopbackOrigin: 'http://127.0.0.1:4301',
      })
    ).address.address,
    '127.0.0.1',
  );
  await assert.rejects(() =>
    resolveWebhookTarget('http://127.0.0.1:4302/', {
      trustedLoopbackOrigin: 'http://127.0.0.1:4301',
    }),
  );
});
test('delivery pins validated DNS, preserves TLS hostname and never follows redirects', async () => {
  let resolutions = 0,
    requests = 0,
    status = 204;
  const fetcher = createWebhookFetcher({
    resolver: async () => {
      resolutions++;
      return [
        { address: resolutions === 1 ? '8.8.8.8' : '127.0.0.1', family: 4 },
      ];
    },
    request: (url, options, callback) => {
      requests++;
      assert.equal(url.hostname, 'merchant.example');
      assert.equal(options.agent, false);
      options.lookup(url.hostname, { all: true }, (error, addresses) => {
        assert.equal(error, null);
        assert.deepEqual(addresses, [{ address: '8.8.8.8', family: 4 }]);
      });
      const req = new EventEmitter();
      req.end = () => callback({ statusCode: status, destroy() {} });
      return req;
    },
  });
  assert.equal(
    (
      await fetcher('https://merchant.example/webhook', {
        headers: {},
        body: '{}',
      })
    ).status,
    204,
  );
  assert.equal(resolutions, 1);
  assert.equal(requests, 1);
  await assert.rejects(
    () =>
      fetcher('https://merchant.example/webhook', { headers: {}, body: '{}' }),
    /PRIVATE_WEBHOOK_ADDRESS/,
  );
  assert.equal(requests, 1);
  resolutions = 0;
  status = 302;
  await assert.rejects(
    () =>
      fetcher('https://merchant.example/webhook', { headers: {}, body: '{}' }),
    /REDIRECT/,
  );
  assert.equal(requests, 2);
});
