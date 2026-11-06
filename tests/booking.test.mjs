import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import Fastify from 'fastify';
import { webhookSignature } from '../src/crypto.mjs';
test(
  'separate merchant survives restart, deduplicates bookings and retries fulfillment acknowledgement',
  { skip: process.env.RUN_FORK_TESTS !== '1' },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'checkout-booking-')),
      secret = 'test-webhook-secret';
    const stub = Fastify();
    let ackFails = true,
      acks = 0;
    stub.post('/v1/checkouts', async (req) => {
      assert.equal(req.headers.authorization, 'Bearer test-api-key');
      assert.equal(req.body.amount, '2000000');
      return { id: 'checkout-one', orderId: req.body.orderId };
    });
    stub.post('/v1/merchant/orders/:id/fulfillment', async (_, reply) => {
      if (ackFails) return reply.code(503).send({ error: { code: 'RETRY' } });
      acks++;
      return { ok: true };
    });
    const api = await stub.listen({ host: '127.0.0.1', port: 0 });
    const reservation = createServer();
    await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    const config = join(dir, 'merchant.json'),
      dbPath = join(dir, 'bookings.sqlite');
    writeFileSync(
      config,
      JSON.stringify({ apiKey: 'test-api-key', webhookSecret: secret }),
      { mode: 0o600 },
    );
    let child;
    async function start() {
      child = spawn(process.execPath, ['examples/booking/server.mjs'], {
        env: {
          ...process.env,
          MERCHANT_CONFIG: config,
          CHECKOUT_API: api,
          BOOKING_PORT: String(port),
          BOOKING_DB: dbPath,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      await Promise.race([
        once(child.stdout, 'data'),
        once(child, 'exit').then(() => {
          throw Error('Merchant failed to start');
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(Error('Merchant startup timeout')),
            10000,
          ).unref(),
        ),
      ]);
    }
    async function stop() {
      if (child && child.exitCode === null) {
        const done = once(child, 'exit');
        child.kill('SIGTERM');
        await done;
      }
    }
    const url = 'http://127.0.0.1:' + port;
    try {
      await start();
      const booked = await fetch(url + '/book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: 'booking-one', amount: '1' }),
      });
      assert.equal(booked.status, 200);
      const payload = JSON.stringify({
          id: 'event-one',
          type: 'payment.confirmed',
          orderId: 'booking-one',
          checkoutId: 'checkout-one',
          amount: '2000000',
        }),
        timestamp = String(Math.floor(Date.now() / 1000));
      const deliver = (signature) =>
        fetch(url + '/webhook', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-checkout-timestamp': timestamp,
            'x-checkout-signature': signature,
          },
          body: payload,
        });
      assert.equal((await deliver('0'.repeat(64))).status, 401);
      const signature = webhookSignature(secret, timestamp, payload);
      assert.equal((await deliver(signature)).status, 500);
      await stop();
      ackFails = false;
      await start();
      assert.equal((await deliver(signature)).status, 200);
      assert.equal((await deliver(signature)).status, 200);
      const db = new DatabaseSync(dbPath);
      try {
        assert.equal(
          db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count,
          1,
        );
        assert.equal(
          db.prepare('SELECT COUNT(*) AS count FROM events').get().count,
          1,
        );
      } finally {
        db.close();
      }
      assert.equal(acks, 2);
    } finally {
      await stop();
      await stub.close();
    }
  },
);
