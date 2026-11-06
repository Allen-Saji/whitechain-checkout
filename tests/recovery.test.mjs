import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db.mjs';
import { hash } from '../src/crypto.mjs';
import { buildApi } from '../src/api.mjs';
import { spawnSync } from 'node:child_process';
test('payment recovery reuses only an unbroadcast valid job and enforces owner, pause and scope', async () => {
  const path = join(
    mkdtempSync(join(tmpdir(), 'checkout-recovery-')),
    'db.sqlite',
  );
  const db = openDatabase(path);
  for (const id of ['a', 'b'])
    db.prepare('INSERT INTO merchants VALUES(?,?,?,?,?,?)').run(
      id,
      '0x1111111111111111111111111111111111111111',
      hash(id),
      'https://example.com',
      'secret',
      '100',
    );
  db.prepare(
    "INSERT INTO checkouts(id,merchant_id,external_id,amount,expires_at,created_at,state) VALUES('order','a','one','100000',?,?,'failed')",
  ).run(Math.floor(Date.now() / 1000) + 900, Date.now());
  db.prepare(
    "INSERT INTO jobs(id,checkout_id,kind,amount,deadline,signer,signature,created_at,status,error) VALUES('job','order','pay','100000',?,'buyer','signature',?,'failed','MERCHANT_GAS_BUDGET')",
  ).run(Math.floor(Date.now() / 1000) + 900, Date.now());
  const config = { relayEnabled: true },
    app = buildApi(config, db);
  const retry = (key = 'a') =>
    app.inject({
      method: 'POST',
      url: '/v1/merchant/orders/order/retry-payment',
      headers: { authorization: 'Bearer ' + key },
      payload: {},
    });
  try {
    assert.equal((await retry('b')).statusCode, 404);
    config.relayEnabled = false;
    assert.equal((await retry()).statusCode, 503);
    config.relayEnabled = true;
    config.relayCheckoutId = 'different';
    assert.equal((await retry()).json().error.code, 'RELAY_SCOPE_RESTRICTED');
    delete config.relayCheckoutId;
    assert.equal((await retry()).json().jobId, 'job');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n, 1);
    assert.equal((await retry()).statusCode, 409);
    for (const fields of [
      "tx_hash='0x123'",
      "raw_tx='0x123'",
      'deadline=0',
      "error='TRANSACTION_REVERTED'",
    ]) {
      db.exec(
        "UPDATE checkouts SET state='failed'; UPDATE jobs SET status='failed',error='MERCHANT_GAS_BUDGET',tx_hash=NULL,raw_tx=NULL,deadline=9999999999",
      );
      db.exec('UPDATE jobs SET ' + fields);
      assert.equal((await retry()).statusCode, 409);
    }
    const run = (args) =>
      spawnSync(
        process.execPath,
        ['scripts/set-merchant-budget.mjs', 'a', '200', ...args],
        { env: { ...process.env, DB_PATH: path }, encoding: 'utf8' },
      );
    assert.equal(run([]).status, 0);
    assert.equal(
      db.prepare("SELECT daily_gas_budget FROM merchants WHERE id='a'").get()
        .daily_gas_budget,
      '100',
    );
    assert.equal(run(['--apply']).status, 0);
    assert.equal(
      db.prepare("SELECT daily_gas_budget FROM merchants WHERE id='a'").get()
        .daily_gas_budget,
      '200',
    );
  } finally {
    await app.close();
    db.close();
  }
});
