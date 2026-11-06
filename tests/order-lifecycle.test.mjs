import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../src/db.mjs';
import { hash } from '../src/crypto.mjs';
import { buildApi } from '../src/api.mjs';
test('order details are immutable and refund reservations expire or cancel without a worker', async () => {
  const db = openDatabase(
    join(mkdtempSync(join(tmpdir(), 'checkout-lifecycle-')), 'db.sqlite'),
  );
  for (const id of ['a', 'b'])
    db.prepare('INSERT INTO merchants VALUES(?,?,?,?,?,?)').run(
      id,
      '0x1111111111111111111111111111111111111111',
      hash(id),
      'https://example.com',
      'secret',
      '10000000000000000',
    );
  db.prepare(
    'INSERT INTO merchant_profiles(merchant_id,business_name,webhook_verified_at) VALUES(?,?,?)',
  ).run('a', 'Acme', Date.now());
  const app = buildApi(
    {
      router: '0x2222222222222222222222222222222222222222',
      domain: {
        name: 'Tether USD',
        version: '1',
        chainId: 1874,
        verifyingContract: '0x3333333333333333333333333333333333333333',
      },
      relayEnabled: true,
    },
    db,
  );
  const req = (url, payload, key = 'a') =>
    app.inject({
      url,
      method: payload === undefined ? 'GET' : 'POST',
      headers: { authorization: 'Bearer ' + key },
      payload,
    });
  try {
    const input = {
      orderId: 'membership-1',
      amount: '100000',
      title: 'Monthly membership',
      description: 'Access to the studio',
    };
    const first = await req('/v1/checkouts', input);
    assert.equal(first.statusCode, 201);
    const order = first.json();
    assert.equal(order.title, input.title);
    assert.equal(order.merchantName, 'Acme');
    assert.equal((await req('/v1/checkouts', input)).json().id, order.id);
    assert.equal(
      (await req('/v1/checkouts', { ...input, title: 'Different product' }))
        .statusCode,
      409,
    );
    db.prepare("UPDATE merchant_profiles SET business_name='New name'").run();
    assert.equal(
      (await req('/v1/checkouts/' + order.id)).json().merchantName,
      'Acme',
    );
    db.prepare(
      "UPDATE checkouts SET state='paid',buyer='0x4444444444444444444444444444444444444444' WHERE id=?",
    ).run(order.id);
    const path = '/v1/merchant/orders/' + order.id + '/refunds';
    const r = await req(path, { refundId: 'first', amount: '60000' });
    assert.equal(r.statusCode, 200);
    assert.equal((await req(path)).json().available, '40000');
    assert.equal(
      (await req(path, { refundId: 'second', amount: '50000' })).json().error
        .code,
      'OVER_REFUND',
    );
    assert.equal(
      (await req('/v1/merchant/refunds/' + r.json().id + '/cancel', {}, 'b'))
        .statusCode,
      404,
    );
    assert.equal(
      (await req('/v1/merchant/refunds/' + r.json().id + '/cancel', {}))
        .statusCode,
      200,
    );
    assert.equal((await req(path)).json().available, '100000');
    assert.equal(
      (
        await req('/v1/merchant/refunds/' + r.json().id + '/submit', {
          signature: '0x' + '00'.repeat(65),
        })
      ).json().error.code,
      'REFUND_UNAVAILABLE',
    );
    const expired = (
      await req(path, { refundId: 'expired', amount: '100000' })
    ).json();
    db.prepare('UPDATE refunds SET deadline=0 WHERE id=?').run(expired.id);
    assert.equal((await req(path)).json().available, '100000');
    assert.equal((await req(path)).json().refunds[0].status, 'expired');
    const full = (
      await req(path, { refundId: 'full', amount: '100000' })
    ).json();
    db.prepare("UPDATE refunds SET status='queued' WHERE id=?").run(full.id);
    assert.equal(
      (await req('/v1/merchant/refunds/' + full.id + '/cancel', {})).statusCode,
      409,
    );
    assert.equal((await req(path)).json().available, '0');
  } finally {
    await app.close();
    db.close();
  }
});
