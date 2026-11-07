import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { openDatabase } from '../src/db.mjs';
import { buildApi } from '../src/api.mjs';
import { hash } from '../src/crypto.mjs';

test('concurrent merchant orders and repeated signed requests produce one job per order', async () => {
  const db = openDatabase(
    join(mkdtempSync(join(tmpdir(), 'checkout-concurrent-')), 'db.sqlite'),
  );
  for (const id of ['merchant-a', 'merchant-b']) {
    db.prepare('INSERT INTO merchants VALUES(?,?,?,?,?,?)').run(
      id,
      privateKeyToAccount(generatePrivateKey()).address,
      hash(id),
      'https://example.com/webhook',
      'secret',
      '10000000000000000',
    );
  }
  const app = buildApi(
    {
      relayEnabled: true,
      router: '0x2222222222222222222222222222222222222222',
      domain: {
        name: 'Tether USD',
        version: '1',
        chainId: 1874,
        verifyingContract: '0x3333333333333333333333333333333333333333',
      },
    },
    db,
  );
  const post = (url, payload, key = 'merchant-a') =>
    app.inject({
      method: 'POST',
      url,
      payload,
      headers: { authorization: 'Bearer ' + key },
    });
  try {
    const requests = Array.from({ length: 12 }, (_, i) => ({
      orderId: 'order-' + Math.floor(i / 2),
      amount: '100000',
      key: i % 2 ? 'merchant-a' : 'merchant-b',
    }));
    const orders = await Promise.all(
      requests.map(async ({ key, ...input }) => {
        const responses = await Promise.all([
          post('/v1/checkouts', input, key),
          post('/v1/checkouts', input, key),
        ]);
        for (const response of responses)
          assert.equal(response.statusCode, 201);
        assert.equal(responses[0].json().id, responses[1].json().id);
        return responses[0].json();
      }),
    );
    assert.equal(new Set(orders.map((o) => o.id)).size, 12);
    const buyers = Array.from({ length: 3 }, () =>
      privateKeyToAccount(generatePrivateKey()),
    );
    await Promise.all(
      orders.map(async (order, i) => {
        const buyer = buyers[i % buyers.length];
        const response = await post(`/v1/checkouts/${order.id}/authorization`, {
          payer: buyer.address,
        });
        assert.equal(response.statusCode, 200);
        const signature = await buyer.signTypedData(response.json());
        const results = await Promise.all(
          Array.from({ length: 3 }, () =>
            post(`/v1/checkouts/${order.id}/pay`, {
              payer: buyer.address,
              signature,
            }),
          ),
        );
        for (const result of results) assert.equal(result.statusCode, 200);
        assert.equal(new Set(results.map((r) => r.json().jobId)).size, 1);
      }),
    );
    assert.equal(db.prepare('SELECT count(*) AS n FROM jobs').get().n, 12);
    assert.equal(
      db
        .prepare("SELECT count(*) AS n FROM checkouts WHERE state='queued'")
        .get().n,
      12,
    );
    for (const key of ['merchant-a', 'merchant-b'])
      assert.equal(
        db
          .prepare('SELECT count(*) AS n FROM checkouts WHERE merchant_id=?')
          .get(key).n,
        6,
      );
  } finally {
    await app.close();
    db.close();
  }
});
