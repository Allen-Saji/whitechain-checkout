import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import Fastify from 'fastify';
test(
  'packed SDK works outside the repository with immutable metadata and raw webhook verification',
  { skip: process.env.RUN_FORK_TESTS !== '1' },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'checkout-sdk-'));
    const pack = spawnSync(
      'npm',
      [
        'pack',
        './sdk',
        '--ignore-scripts',
        '--pack-destination',
        dir,
        '--json',
      ],
      { encoding: 'utf8' },
    );
    assert.equal(pack.status, 0, pack.stderr);
    const archive = JSON.parse(pack.stdout)[0];
    assert(archive.files.some((f) => f.path === 'server.d.mts'));
    assert(
      archive.files.some(
        (f) => f.path === 'skills/integrate-checkout/SKILL.md',
      ),
    );
    assert.equal(
      spawnSync('tar', ['-xzf', join(dir, archive.filename), '-C', dir]).status,
      0,
    );
    const sdk = await import(
      pathToFileURL(join(dir, 'package/server.mjs')).href
    );
    const app = Fastify();
    app.post('/v1/checkouts', async (req) => {
      assert.equal(req.headers.authorization, 'Bearer test-key');
      return { id: 'order', ...req.body };
    });
    app.get('/v1/checkouts/order', async () => ({
      id: 'order',
      state: 'paid',
    }));
    await app.listen({ host: '127.0.0.1', port: 0 });
    try {
      const client = sdk.checkoutClient({
        baseUrl: app.listeningOrigin,
        apiKey: 'test-key',
      });
      const order = await client.create({
        orderId: 'one',
        amount: '1000000',
        title: 'Membership',
        description: 'One month',
      });
      assert.equal(order.title, 'Membership');
      assert.equal(order.amount, '1000000');
      assert.equal((await client.get('order')).state, 'paid');
      const now = Date.now(),
        timestamp = String(Math.floor(now / 1000)),
        body = '{"id":"event-1"}',
        signature = createHmac('sha256', 'secret')
          .update(timestamp + '.' + body)
          .digest('hex');
      assert(sdk.verifyWebhook('secret', timestamp, body, signature, now));
      assert(
        !sdk.verifyWebhook('secret', timestamp, body + ' ', signature, now),
      );
      assert(
        !sdk.verifyWebhook('secret', timestamp, body, signature, now + 301000),
      );
    } finally {
      await app.close();
    }
  },
);
test('published integration skill matches the SDK skill and API paths exist', () => {
  assert.equal(
    readFileSync('web/public/skill.md', 'utf8'),
    readFileSync('sdk/skills/integrate-checkout/SKILL.md', 'utf8'),
  );
  const schema = JSON.parse(readFileSync('web/public/openapi.json', 'utf8'));
  const source =
    ['checkouts', 'refunds', 'merchant', 'onboarding']
      .map((n) => readFileSync(`src/api/${n}.mjs`, 'utf8'))
      .join('\n') + readFileSync('src/api.mjs', 'utf8');
  for (const [path, methods] of Object.entries(schema.paths))
    for (const method of Object.keys(methods)) {
      const route = path.replace(/\{([^}]+)\}/g, ':$1');
      assert(
        source.includes(`app.${method}('${route}'`),
        `${method} ${path} is not registered`,
      );
    }
});
