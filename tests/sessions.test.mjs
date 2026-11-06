import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { openDatabase } from '../src/db.mjs';
import { buildApi } from '../src/api.mjs';
import { hash } from '../src/crypto.mjs';
const origin = 'http://127.0.0.1:4210';
test('wallet sessions enforce origin, signature, replay, merchant scope and logout', async () => {
  const db = openDatabase(
    join(mkdtempSync(join(tmpdir(), 'checkout-session-')), 'db.sqlite'),
  );
  const owner = privateKeyToAccount(generatePrivateKey()),
    other = privateKeyToAccount(generatePrivateKey());
  db.prepare('INSERT INTO merchants VALUES(?,?,?,?,?,?)').run(
    'owner',
    owner.address,
    hash('operator-api-key'),
    'https://example.com/webhook',
    'private-webhook-secret',
    '100',
  );
  db.prepare('INSERT INTO merchants VALUES(?,?,?,?,?,?)').run(
    'other',
    other.address,
    hash('other-api-key'),
    'https://example.com/webhook',
    'other-secret',
    '100',
  );
  const app = buildApi(
    { appOrigin: origin, local: true, demoMerchantId: 'owner' },
    db,
  );
  const call = (url, payload, headers = { origin }) =>
    app.inject({ method: 'POST', url, payload, headers });
  try {
    assert.equal(
      (
        await call(
          '/v1/session/challenge',
          { address: owner.address },
          { origin: 'https://attacker.example' },
        )
      ).statusCode,
      403,
    );
    const challenge = (
      await call('/v1/session/challenge', { address: owner.address })
    ).json();
    assert(challenge.message.includes(origin));
    assert(challenge.message.includes('Chain ID: 1874'));
    const wrong = await other.signMessage({ message: challenge.message });
    assert.equal(
      (await call('/v1/session/verify', { id: challenge.id, signature: wrong }))
        .statusCode,
      401,
    );
    const signature = await owner.signMessage({ message: challenge.message }),
      verified = await call('/v1/session/verify', {
        id: challenge.id,
        signature,
      });
    assert.equal(verified.statusCode, 200);
    assert.match(verified.headers['set-cookie'], /HttpOnly; SameSite=Strict/);
    assert.equal(verified.json().expiresIn, 604800);
    const cookie = verified.headers['set-cookie'].split(';')[0];
    assert.equal(
      (await call('/v1/session/verify', { id: challenge.id, signature }))
        .statusCode,
      401,
    );
    const checkout = await call(
      '/v1/checkouts',
      { orderId: 'owner-order', amount: '2000000' },
      { origin, cookie },
    );
    assert.equal(checkout.statusCode, 201);
    assert.equal(
      (
        await call(
          '/v1/checkouts',
          { orderId: 'forged', amount: '1' },
          { origin: 'https://attacker.example', cookie },
        )
      ).statusCode,
      403,
    );
    const orders = await app.inject({
      url: '/v1/merchant/orders',
      headers: { cookie },
    });
    assert.equal(orders.json().orders.length, 1);
    assert.equal(orders.json().orders[0].merchant_id, 'owner');
    const otherOrders = await app.inject({
      url: '/v1/merchant/orders',
      headers: { authorization: 'Bearer other-api-key' },
    });
    assert.equal(otherOrders.json().orders.length, 0);
    const demo = await app.inject({ url: '/v1/demo' });
    assert.equal(demo.json().readOnly, true);
    assert(!demo.body.includes('private-webhook-secret'));
    assert(!demo.body.includes('api_hash'));
    await call('/v1/session/logout', {}, { origin, cookie });
    assert.equal(
      (await app.inject({ url: '/v1/session', headers: { cookie } }))
        .statusCode,
      401,
    );
  } finally {
    await app.close();
    db.close();
  }
});
test('expired challenges and unregistered wallets cannot create merchant sessions', async () => {
  const db = openDatabase(
      join(mkdtempSync(join(tmpdir(), 'checkout-expiry-')), 'db.sqlite'),
    ),
    owner = privateKeyToAccount(generatePrivateKey()),
    app = buildApi({ appOrigin: origin, local: true }, db);
  const challenge = async () =>
    (
      await app.inject({
        method: 'POST',
        url: '/v1/session/challenge',
        headers: { origin },
        payload: { address: owner.address },
      })
    ).json();
  try {
    const first = await challenge();
    db.prepare('UPDATE auth_challenges SET expires_at=0 WHERE id=?').run(
      first.id,
    );
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/session/verify',
          headers: { origin },
          payload: {
            id: first.id,
            signature: await owner.signMessage({ message: first.message }),
          },
        })
      ).statusCode,
      401,
    );
    const second = await challenge();
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/session/verify',
          headers: { origin },
          payload: {
            id: second.id,
            signature: await owner.signMessage({ message: second.message }),
          },
        })
      ).statusCode,
      403,
    );
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM merchant_sessions').get().count,
      0,
    );
    assert.equal((await app.inject({ url: '/v1/demo' })).statusCode, 404);
  } finally {
    await app.close();
    db.close();
  }
});

test('paused relayer mode rejects payment and refund submission without queuing jobs', async () => {
  const db = openDatabase(
      join(mkdtempSync(join(tmpdir(), 'checkout-paused-')), 'db.sqlite'),
    ),
    app = buildApi({ appOrigin: origin, relayEnabled: false, local: true }, db);
  try {
    for (const url of [
      '/v1/checkouts/unknown/pay',
      '/v1/merchant/refunds/unknown/submit',
    ]) {
      const result = await app.inject({ method: 'POST', url, payload: {} });
      assert.equal(result.statusCode, 503);
      assert.equal(result.json().error.code, 'RELAYER_PAUSED');
    }
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM jobs').get().count,
      0,
    );
  } finally {
    await app.close();
    db.close();
  }
});
