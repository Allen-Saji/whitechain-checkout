import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../src/db.mjs';
import { createIndexer } from '../src/workers/indexer.mjs';
import { createOutbox } from '../src/workers/outbox.mjs';
import { verifyAuthorization } from '../src/api/validation.mjs';

function database() {
  return openDatabase(
    join(mkdtempSync(join(tmpdir(), 'checkout-safety-')), 'service.sqlite'),
  );
}

test('changed checkpoint hash halts processing before any delivery or new relay work', async () => {
  const db = database();
  try {
    db.prepare('INSERT INTO checkpoints VALUES(1,100,?,0)').run('0xold');
    const index = createIndexer(
      { client: { getBlock: async () => ({ hash: '0xnew' }) } },
      db,
      () => true,
    );
    await assert.rejects(index(), /CHAIN_REVIEW_REQUIRED/);
    assert.equal(db.prepare('SELECT halted FROM checkpoints').get().halted, 1);
  } finally {
    db.close();
  }
});

test('outbox cannot overwrite delivery state after losing its worker lease', async () => {
  const db = database();
  let owns = true;
  try {
    db.prepare('INSERT INTO merchants VALUES(?,?,?,?,?,?)').run(
      'm',
      '0x1111111111111111111111111111111111111111',
      'hash',
      'http://127.0.0.1/webhook',
      'test-secret',
      '100',
    );
    db.prepare(
      'INSERT INTO outbox(id,merchant_id,checkout_id,payload,next_at,created_at) VALUES(?,?,?,?,?,?)',
    ).run('event', 'm', 'order', '{}', 0, 0);
    const deliver = createOutbox(
      db,
      () => owns,
      async () => {
        owns = false;
        return { status: 200 };
      },
    );
    await assert.rejects(deliver(), /WORKER_LEASE_LOST/);
    const row = db.prepare('SELECT status,attempts FROM outbox').get();
    assert.equal(row.status, 'pending');
    assert.equal(row.attempts, 0);
  } finally {
    db.close();
  }
});

test('malformed cryptographic signatures are rejected without an internal server error', async () => {
  assert.equal(
    await verifyAuthorization({
      signature: '0x' + '00'.repeat(65),
      address: '0x1111111111111111111111111111111111111111',
      domain: { chainId: 1874 },
      types: { Message: [{ name: 'value', type: 'uint256' }] },
      primaryType: 'Message',
      message: { value: 1n },
    }),
    false,
  );
});

test('a slow merchant webhook does not block other merchants in the batch', async () => {
  const db = database();
  let release;
  const slow = new Promise((resolve) => {
    release = resolve;
  });
  try {
    for (const id of ['slow', 'fast']) {
      db.prepare('INSERT INTO merchants VALUES(?,?,?,?,?,?)').run(
        id,
        '0x1111111111111111111111111111111111111111',
        id,
        'https://' + id + '.example/webhook',
        'secret',
        '100',
      );
      db.prepare(
        'INSERT INTO outbox(id,merchant_id,checkout_id,payload,next_at,created_at) VALUES(?,?,?,?,?,?)',
      ).run(id, id, id, '{}', 0, 0);
    }
    const deliver = createOutbox(
      db,
      () => true,
      async (url) => {
        if (url.includes('slow.')) await slow;
        return { status: 200 };
      },
    );
    const pending = deliver();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      db.prepare('SELECT status FROM outbox WHERE id=?').get('fast').status,
      'delivered',
    );
    assert.equal(
      db.prepare('SELECT status FROM outbox WHERE id=?').get('slow').status,
      'pending',
    );
    release();
    await pending;
    assert.equal(
      db
        .prepare("SELECT count(*) AS n FROM outbox WHERE status='delivered'")
        .get().n,
      2,
    );
  } finally {
    release();
    db.close();
  }
});

test('overlapping worker ticks cannot acquire the same relay lease twice', async () => {
  const { createWorker } = await import('../src/worker-core.mjs');
  const { privateKeyToAccount, generatePrivateKey } =
    await import('viem/accounts');
  const db = database();
  let release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const config = {
    relayEnabled: true,
    local: false,
    deploymentBlock: 1,
    confirmations: 1,
    rpc: 'https://example.com',
    account: privateKeyToAccount(generatePrivateKey()),
    client: {
      getBlockNumber: async () => {
        calls++;
        await waiting;
        return 0n;
      },
    },
  };
  const worker = createWorker(config, db);
  const other = createWorker(config, db);
  try {
    const first = worker.tick();
    assert.equal(await worker.tick(), false);
    assert.equal(await other.tick(), false);
    assert.equal(calls, 1);
    release();
    assert.equal(await first, true);
    assert.equal(await other.tick(), true);
  } finally {
    release();
    db.close();
  }
});
