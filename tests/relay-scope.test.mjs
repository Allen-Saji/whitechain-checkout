import test from 'node:test';
import assert from 'node:assert/strict';
import { relayScopeAllows } from '../src/relay-scope.mjs';
test('scoped relay accepts only the approved checkout and bounded amounts', () => {
  const config = {
    relayCheckoutId: 'approved',
    relayMaxPaymentAmount: '100000',
    relayMaxRefundAmount: '50000',
  };
  assert(
    relayScopeAllows(config, {
      checkoutId: 'approved',
      kind: 'pay',
      amount: '100000',
    }),
  );
  assert(
    relayScopeAllows(config, {
      checkoutId: 'approved',
      kind: 'refund',
      amount: '50000',
    }),
  );
  assert(
    !relayScopeAllows(config, {
      checkoutId: 'other',
      kind: 'pay',
      amount: '1',
    }),
  );
  assert(
    !relayScopeAllows(config, {
      checkoutId: 'approved',
      kind: 'pay',
      amount: '100001',
    }),
  );
  assert(
    !relayScopeAllows(config, {
      checkoutId: 'approved',
      kind: 'refund',
      amount: '50001',
    }),
  );
  assert(
    relayScopeAllows(
      {},
      { checkoutId: 'normal', kind: 'pay', amount: '2000000' },
    ),
  );
});

test('authorization rejects paused or out-of-scope orders before asking for a signature', async () => {
  const { openDatabase } = await import('../src/db.mjs');
  const { buildApi } = await import('../src/api.mjs');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const db = openDatabase(
    join(mkdtempSync(join(tmpdir(), 'checkout-scope-')), 'db.sqlite'),
  );
  db.prepare('INSERT INTO merchants VALUES(?,?,?,?,?,?)').run(
    'merchant',
    '0x1111111111111111111111111111111111111111',
    'hash',
    'https://example.com/webhook',
    'secret',
    '100',
  );
  db.prepare(
    'INSERT INTO checkouts(id,merchant_id,external_id,amount,expires_at,created_at) VALUES(?,?,?,?,?,?)',
  ).run(
    'order',
    'merchant',
    'one',
    '100000',
    Math.floor(Date.now() / 1000) + 900,
    Date.now(),
  );
  const config = { relayEnabled: false, relayCheckoutId: 'different' };
  const app = buildApi(config, db);
  const request = () =>
    app.inject({
      method: 'POST',
      url: '/v1/checkouts/order/authorization',
      payload: { payer: '0x2222222222222222222222222222222222222222' },
    });
  try {
    assert.equal((await request()).json().error.code, 'RELAYER_PAUSED');
    config.relayEnabled = true;
    assert.equal((await request()).json().error.code, 'RELAY_SCOPE_RESTRICTED');
    assert.equal(db.prepare('SELECT count(*) AS n FROM jobs').get().n, 0);
  } finally {
    await app.close();
    db.close();
  }
});
