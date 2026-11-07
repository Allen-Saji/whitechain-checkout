import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, reserveGas } from '../src/db.mjs';
import { webhookSignature, verifyWebhook, hash } from '../src/crypto.mjs';
import { buildApi } from '../src/api.mjs';
test('signed webhook rejects altered body, old timestamp and malformed signature', () => {
  const secret = 'test-only-secret',
    now = Date.now(),
    timestamp = String(Math.floor(now / 1000)),
    body = '{"id":"one"}';
  const signature = webhookSignature(secret, timestamp, body);
  assert(verifyWebhook(secret, timestamp, body, signature, now));
  assert(!verifyWebhook(secret, timestamp, body + ' ', signature, now));
  assert(!verifyWebhook(secret, timestamp, body, signature, now + 301000));
  assert(!verifyWebhook(secret, timestamp, body, 'a', now));
});
test('gas reservation recovery cannot bypass the merchant budget with a larger estimate', () => {
  const db = openDatabase(
    join(mkdtempSync(join(tmpdir(), 'checkout-budget-')), 'test.sqlite'),
  );
  try {
    const merchant = { id: 'merchant', daily_gas_budget: '100' },
      job = { id: 'job' };
    reserveGas(db, job, merchant, 40n);
    reserveGas(db, job, merchant, 60n);
    assert.equal(
      db.prepare('SELECT amount FROM gas_reservations').get().amount,
      '60',
    );
    assert.throws(
      () => reserveGas(db, job, merchant, 101n),
      /MERCHANT_GAS_BUDGET/,
    );
    assert.equal(
      db.prepare('SELECT amount FROM gas_reservations').get().amount,
      '60',
    );
  } finally {
    db.close();
  }
});
test('merchant isolation, immutable pricing, fail-closed chain review and public rate limiting', async () => {
  const db = openDatabase(
    join(mkdtempSync(join(tmpdir(), 'checkout-api-')), 'test.sqlite'),
  );
  const payout = '0x1111111111111111111111111111111111111111';
  db.prepare('INSERT INTO merchants VALUES(?,?,?,?,?,?)').run(
    'a',
    payout,
    hash('a-key'),
    'https://example.com/hook',
    'a-secret',
    '100',
  );
  db.prepare('INSERT INTO merchants VALUES(?,?,?,?,?,?)').run(
    'b',
    payout,
    hash('b-key'),
    'https://example.com/hook',
    'b-secret',
    '100',
  );
  const app = buildApi({ local: true }, db);
  const headers = { authorization: 'Bearer a-key' };
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/checkouts',
      headers,
      payload: { orderId: 'order', amount: '2000000' },
    });
    assert.equal(created.statusCode, 201);
    assert.equal(
      created.json().token,
      '0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7',
    );
    assert.equal(created.json().checkoutUrl, null);
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/checkouts',
          headers,
          payload: { orderId: 'order', amount: '1' },
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/merchant/orders/' + created.json().id + '/fulfillment',
          headers: { authorization: 'Bearer b-key' },
          payload: { state: 'fulfilled' },
        })
      ).statusCode,
      404,
    );
    db.prepare('INSERT INTO checkpoints VALUES(1,0,NULL,1)').run();
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/checkouts',
          headers,
          payload: { orderId: 'other', amount: '1' },
        })
      ).statusCode,
      503,
    );
    let response;
    for (let i = 0; i < 121; i++)
      response = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 429);
  } finally {
    await app.close();
    db.close();
  }
});

test('a shared gas cap prevents additional merchants bypassing the deployment budget', () => {
  const db = openDatabase(
    join(mkdtempSync(join(tmpdir(), 'checkout-global-budget-')), 'db.sqlite'),
  );
  try {
    const first = { id: 'first', checkout_id: 'a' },
      second = { id: 'second', checkout_id: 'b' };
    reserveGas(
      db,
      first,
      { id: 'merchant-a', daily_gas_budget: '100' },
      60n,
      Date.now(),
      100n,
    );
    assert.throws(
      () =>
        reserveGas(
          db,
          second,
          { id: 'merchant-b', daily_gas_budget: '100' },
          60n,
          Date.now(),
          100n,
        ),
      /GLOBAL_GAS_BUDGET/,
    );
  } finally {
    db.close();
  }
});

test('unlimited gas sponsorship retains accounting and respects any remaining finite cap', async () => {
  const { isGasBudget, exceedsGasBudget } =
    await import('../src/gas-policy.mjs');
  assert(isGasBudget('unlimited'));
  assert(!isGasBudget('invalid'));
  assert(!exceedsGasBudget(10n ** 30n, 'unlimited'));
  const db = openDatabase(
    join(mkdtempSync(join(tmpdir(), 'checkout-unlimited-')), 'test.sqlite'),
  );
  try {
    const merchant = { id: 'unlimited', daily_gas_budget: 'unlimited' };
    reserveGas(db, { id: 'a' }, merchant, 1000n, Date.now(), 'unlimited');
    reserveGas(db, { id: 'b' }, merchant, 2000n, Date.now(), 'unlimited');
    assert.equal(
      db.prepare('SELECT count(*) AS n FROM gas_reservations').get().n,
      2,
    );
    assert.throws(
      () => reserveGas(db, { id: 'c' }, merchant, 1n, Date.now(), '3000'),
      /GLOBAL_GAS_BUDGET/,
    );
    assert.throws(
      () =>
        reserveGas(
          db,
          { id: 'd' },
          { id: 'limited', daily_gas_budget: '10' },
          11n,
          Date.now(),
          'unlimited',
        ),
      /MERCHANT_GAS_BUDGET/,
    );
  } finally {
    db.close();
  }
});
