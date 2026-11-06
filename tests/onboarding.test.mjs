import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { openDatabase, reserveGas } from '../src/db.mjs';
import { buildApi } from '../src/api.mjs';
import { verifyWebhook } from '../src/crypto.mjs';
const origin = 'http://127.0.0.1:4210';
function fixture(fetcher, config = {}) {
  const db = openDatabase(
    join(mkdtempSync(join(tmpdir(), 'checkout-onboarding-')), 'db.sqlite'),
  );
  const app = buildApi(
    { appOrigin: origin, registrationEnabled: true, local: false, ...config },
    db,
    { webhookFetcher: fetcher },
  );
  return {
    db,
    app,
    post: (url, payload, cookie, extra = {}) =>
      app.inject({
        method: 'POST',
        url,
        payload,
        headers: { origin, ...(cookie ? { cookie } : {}), ...extra },
      }),
  };
}
test('registration binds wallet and business, rejects replay and requires a working integration', async () => {
  let delivered;
  const { db, app, post } = fixture(async (url, init) => {
    delivered = { url, init };
    return { status: 204, body: null };
  });
  const owner = privateKeyToAccount(generatePrivateKey()),
    other = privateKeyToAccount(generatePrivateKey());
  try {
    const challenge = (
      await post('/v1/registration/challenge', {
        address: owner.address,
        businessName: 'Test business',
      })
    ).json();
    assert.match(challenge.message, /Test business/);
    assert.equal(
      (
        await post('/v1/registration/verify', {
          id: challenge.id,
          signature: await other.signMessage({ message: challenge.message }),
        })
      ).statusCode,
      401,
    );
    const signature = await owner.signMessage({ message: challenge.message });
    const result = await post('/v1/registration/verify', {
      id: challenge.id,
      signature,
    });
    assert.equal(result.statusCode, 200);
    const { merchant, credentials } = result.json(),
      cookie = result.headers['set-cookie'].split(';')[0];
    assert.equal(merchant.payout, owner.address);
    assert.equal(merchant.businessName, 'Test business');
    const storedMerchant = db
      .prepare('SELECT * FROM merchants WHERE id=?')
      .get(merchant.id);
    assert.equal(storedMerchant.daily_gas_budget, '10000000000000000');
    // Reproduce the estimate that previously rejected a funded hosted payment.
    const observedCap = 1672670732000000n;
    reserveGas(db, { id: 'hosted-payment' }, storedMerchant, observedCap);
    reserveGas(db, { id: 'hosted-refund' }, storedMerchant, observedCap);
    assert.throws(
      () =>
        reserveGas(
          db,
          { id: 'over-budget' },
          storedMerchant,
          10000000000000000n,
        ),
      /MERCHANT_GAS_BUDGET/,
    );
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM gas_reservations').get().count,
      2,
    );

    assert.equal(
      (await post('/v1/registration/verify', { id: challenge.id, signature }))
        .statusCode,
      401,
    );
    assert.equal(
      (
        await post('/v1/registration/challenge', {
          address: owner.address,
          businessName: 'Duplicate',
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await post('/v1/checkouts', { orderId: 'first', amount: '1' }, cookie)
      ).json().error.code,
      'INTEGRATION_NOT_READY',
    );
    assert.equal(
      (
        await post(
          '/v1/merchant/settings',
          { businessName: 'Test business', webhookUrl: 'http://127.0.0.1:80/' },
          cookie,
        )
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await post(
          '/v1/merchant/settings',
          {
            businessName: 'Test business',
            webhookUrl: 'https://merchant.example/webhook',
          },
          cookie,
          { origin: 'https://attacker.example' },
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await post(
          '/v1/merchant/settings',
          {
            businessName: 'Test business',
            webhookUrl: 'https://merchant.example/webhook',
          },
          cookie,
        )
      ).statusCode,
      200,
    );
    const check = await post('/v1/merchant/webhook/check', {}, cookie);
    assert.equal(check.statusCode, 200);
    assert(check.json().webhookVerifiedAt);
    assert(
      verifyWebhook(
        credentials.webhookSecret,
        delivered.init.headers['x-checkout-timestamp'],
        delivered.init.body,
        delivered.init.headers['x-checkout-signature'],
      ),
    );
    assert.equal(JSON.parse(delivered.init.body).type, 'integration.check');
    assert.equal(
      (await post('/v1/merchant/webhook/check', {}, cookie)).statusCode,
      429,
    );
    const before = await app.inject({
      url: '/v1/merchant/settings',
      headers: { cookie },
    });
    assert(!before.body.includes(credentials.apiKey));
    assert(!before.body.includes(credentials.webhookSecret));
    assert.equal(
      (await post('/v1/checkouts', { orderId: 'first', amount: '1' }, cookie))
        .statusCode,
      201,
    );
    const rotated = await post(
      '/v1/merchant/credentials/rotate',
      { credential: 'apiKey' },
      cookie,
    );
    assert.equal(rotated.statusCode, 200);
    assert.equal(
      (
        await app.inject({
          url: '/v1/merchant/orders',
          headers: { authorization: 'Bearer ' + credentials.apiKey },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          url: '/v1/merchant/orders',
          headers: { authorization: 'Bearer ' + rotated.json().value },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await post(
          '/v1/merchant/credentials/rotate',
          { credential: 'apiKey' },
          null,
          { authorization: 'Bearer ' + rotated.json().value },
        )
      ).statusCode,
      401,
    );
    await post(
      '/v1/merchant/credentials/rotate',
      { credential: 'webhookSecret' },
      cookie,
    );
    assert.equal(
      (
        await post('/v1/checkouts', { orderId: 'next', amount: '1' }, cookie)
      ).json().error.code,
      'INTEGRATION_NOT_READY',
    );
  } finally {
    await app.close();
    db.close();
  }
});
test('a failed or stale webhook check cannot activate an integration', async () => {
  let finish;
  const { db, app, post } = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const owner = privateKeyToAccount(generatePrivateKey());
  try {
    const c = (
      await post('/v1/registration/challenge', {
        address: owner.address,
        businessName: 'Merchant',
      })
    ).json();
    const r = await post('/v1/registration/verify', {
      id: c.id,
      signature: await owner.signMessage({ message: c.message }),
    });
    const cookie = r.headers['set-cookie'].split(';')[0];
    await post(
      '/v1/merchant/settings',
      {
        businessName: 'Merchant',
        webhookUrl: 'https://merchant.example/first',
      },
      cookie,
    );
    const pending = post('/v1/merchant/webhook/check', {}, cookie);
    while (!finish) await new Promise((resolve) => setImmediate(resolve));
    await post(
      '/v1/merchant/settings',
      { businessName: 'Merchant', webhookUrl: 'https://merchant.example/new' },
      cookie,
    );
    finish({ status: 204 });
    assert.equal((await pending).statusCode, 409);
    assert.equal(
      (
        await app.inject({ url: '/v1/merchant/settings', headers: { cookie } })
      ).json().webhookVerifiedAt,
      null,
    );
    const failed = post('/v1/merchant/webhook/check', {}, cookie);
    const previous = finish;
    while (finish === previous)
      await new Promise((resolve) => setImmediate(resolve));
    finish({ status: 503 });
    assert.equal((await failed).json().webhookVerifiedAt, null);
  } finally {
    await app.close();
    db.close();
  }
});

test('registration preserves an explicit operator gas allowance', async () => {
  const { db, app, post } = fixture(undefined, {
    registrationDailyGasBudget: '123456789',
  });
  const owner = privateKeyToAccount(generatePrivateKey());
  try {
    const challenge = (
      await post('/v1/registration/challenge', {
        address: owner.address,
        businessName: 'Custom allowance',
      })
    ).json();
    const response = await post('/v1/registration/verify', {
      id: challenge.id,
      signature: await owner.signMessage({ message: challenge.message }),
    });
    assert.equal(response.statusCode, 200);
    const merchant = db
      .prepare('SELECT daily_gas_budget FROM merchants WHERE id=?')
      .get(response.json().merchant.id);
    assert.equal(merchant.daily_gas_budget, '123456789');
  } finally {
    await app.close();
    db.close();
  }
});
