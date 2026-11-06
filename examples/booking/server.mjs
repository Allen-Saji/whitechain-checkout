import Fastify from 'fastify';
import { readFileSync, mkdirSync, chmodSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { checkoutClient, verifyWebhook } from '../../sdk/server.mjs';
const credentials = JSON.parse(
  readFileSync(process.env.MERCHANT_CONFIG ?? '.local/merchant-fork.json'),
);
const checkout = checkoutClient({
  baseUrl: process.env.CHECKOUT_API ?? 'http://127.0.0.1:4200',
  apiKey: credentials.apiKey,
});
mkdirSync('.local', { recursive: true, mode: 0o700 });
const path = process.env.BOOKING_DB ?? '.local/booking.sqlite',
  db = new DatabaseSync(path);
chmodSync(path, 0o600);
db.exec(`PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,amount TEXT NOT NULL,checkout_id TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS bookings(order_id TEXT PRIMARY KEY,checkout_id TEXT UNIQUE NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY);`);
const price = process.env.DEMO_PRICE ?? '2000000';
if (!/^[1-9][0-9]{0,12}$/.test(price)) throw Error('INVALID_DEMO_PRICE');
const app = Fastify({ logger: false, bodyLimit: 16000 });
app.get('/product', async () => ({
  title: 'Build with stablecoins',
  amount: price,
  token: 'USDT',
  chainId: 1874,
  testnet: true,
}));
app.removeContentTypeParser('application/json');
app.addContentTypeParser(
  'application/json',
  { parseAs: 'string' },
  (_, body, done) => done(null, body),
);
app.post('/book', async (req, reply) => {
  let input;
  try {
    input = JSON.parse(req.body ?? '{}');
  } catch {
    return reply.code(400).send({ error: 'INVALID_JSON' });
  }
  // Stable client order ID permits safe retry; price always comes from this server.
  const id = input.orderId ?? randomUUID();
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id))
    return reply.code(400).send({ error: 'INVALID_ORDER_ID' });
  db.prepare('INSERT OR IGNORE INTO orders(id,amount) VALUES(?,?)').run(
    id,
    price,
  );
  const existing = db.prepare('SELECT amount FROM orders WHERE id=?').get(id);
  const order = await checkout.create({ orderId: id, amount: existing.amount });
  db.prepare('UPDATE orders SET checkout_id=? WHERE id=?').run(order.id, id);
  return order;
});
app.post('/webhook', async (req, reply) => {
  if (
    !verifyWebhook(
      credentials.webhookSecret,
      req.headers['x-checkout-timestamp'],
      req.body,
      req.headers['x-checkout-signature'],
    )
  )
    return reply.code(401).send({ error: 'INVALID_SIGNATURE' });
  // Restart with MERCHANT_DOWN=1 to demonstrate an outage without losing the DB.
  if (process.env.MERCHANT_DOWN === '1')
    return reply.code(503).send({ error: 'BOOKING_UNAVAILABLE' });
  const event = JSON.parse(req.body);
  if (event.type !== 'payment.confirmed') return { received: true };
  const order = db
    .prepare('SELECT * FROM orders WHERE id=?')
    .get(event.orderId);
  if (
    !order ||
    order.checkout_id !== event.checkoutId ||
    order.amount !== event.amount
  )
    return reply.code(409).send({ error: 'ORDER_MISMATCH' });
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT OR IGNORE INTO bookings VALUES(?,?,?)').run(
      order.id,
      event.checkoutId,
      Date.now(),
    );
    db.prepare('INSERT OR IGNORE INTO events VALUES(?)').run(event.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  // Repeated notifications repeat the acknowledgement, not the booking.
  await checkout.fulfill(event.checkoutId);
  return { received: true };
});
app.get('/bookings/:id', async (req, reply) => {
  const booking = db
    .prepare('SELECT * FROM bookings WHERE order_id=?')
    .get(req.params.id);
  return booking ?? reply.code(404).send({ error: 'NOT_BOOKED' });
});
await app.listen({
  host: '127.0.0.1',
  port: Number(process.env.BOOKING_PORT ?? 4300),
});
console.log(
  'Workshop merchant listening on loopback port ' +
    (process.env.BOOKING_PORT ?? 4300),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await app.close();
    db.close();
  });
