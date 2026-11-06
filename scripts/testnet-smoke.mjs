import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createWalletClient, http, erc20Abi } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { loadConfig } from '../src/config.mjs';
import { openDatabase } from '../src/db.mjs';
import { buildApi } from '../src/api.mjs';
import { createWorker } from '../src/worker-core.mjs';
import { hash } from '../src/crypto.mjs';
import { REQUIRED_TOKEN, onchainId } from '../src/protocol.mjs';
import { transferTestTokens } from './lib/journaled-transfer.mjs';

if (!process.argv.includes('--execute'))
  throw Error(
    'Use --execute to authorize public testnet writes. Funds are test tokens only.',
  );
if (process.env.LOCAL_FORK === '1') throw Error('PUBLIC_TESTNET_REQUIRED');
const directory = '.local/live-proof';
mkdirSync(directory, { recursive: true, mode: 0o700 });
const identitiesPath = directory + '/identities.json';
if (!existsSync(identitiesPath))
  writeFileSync(
    identitiesPath,
    JSON.stringify({
      buyer: generatePrivateKey(),
      merchant: generatePrivateKey(),
      apiKey: randomBytes(32).toString('hex'),
      webhookSecret: randomBytes(32).toString('hex'),
    }),
    { flag: 'wx', mode: 0o600 },
  );
const identities = JSON.parse(readFileSync(identitiesPath));
const buyer = privateKeyToAccount(identities.buyer),
  merchant = privateKeyToAccount(identities.merchant);
process.env.DB_PATH = directory + '/service.sqlite';
const config = await loadConfig(),
  client = config.client;
const wallet = createWalletClient({
  account: config.account,
  chain: config.chain,
  transport: http(config.rpc, { timeout: 20000, retryCount: 0 }),
});
const funding = await transferTestTokens({
  client,
  wallet,
  token: REQUIRED_TOKEN,
  to: buyer.address,
  amount: 2500000n,
  path: directory + '/funding.json',
});
console.log(
  'Fresh buyer funded with 2.5 required test USDT: ' + funding.transactionHash,
);
const db = openDatabase(config.dbPath);
// This is a fresh demonstration database. No earlier service orders exist to recover.
if (!db.prepare('SELECT 1 FROM checkpoints').get()) {
  const block = await client.getBlock();
  db.prepare('INSERT INTO checkpoints VALUES(1,?,?,0)').run(
    Number(block.number),
    block.hash,
  );
}
const merchantId = 'workshop-live';
const credentials = {
  apiKey: identities.apiKey,
  webhookSecret: identities.webhookSecret,
};
writeFileSync(directory + '/merchant.json', JSON.stringify(credentials), {
  mode: 0o600,
});
db.prepare('INSERT OR IGNORE INTO merchants VALUES(?,?,?,?,?,?)').run(
  merchantId,
  merchant.address,
  hash(identities.apiKey),
  'http://127.0.0.1:4301/webhook',
  identities.webhookSecret,
  '50000000000000000',
);
const app = buildApi(config, db),
  apiUrl = await app.listen({ host: '127.0.0.1', port: 0 });
const worker = createWorker(config, db);
let merchantProcess;
async function startMerchant(down) {
  merchantProcess = spawn(process.execPath, ['examples/booking/server.mjs'], {
    env: {
      ...process.env,
      MERCHANT_CONFIG: directory + '/merchant.json',
      BOOKING_DB: directory + '/bookings.sqlite',
      CHECKOUT_API: apiUrl,
      BOOKING_PORT: '4301',
      MERCHANT_DOWN: down ? '1' : '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await Promise.race([
    once(merchantProcess.stdout, 'data'),
    once(merchantProcess, 'exit').then(() => {
      throw Error('MERCHANT_START_FAILED');
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(Error('MERCHANT_START_TIMEOUT')), 10000).unref(),
    ),
  ]);
}
async function stopMerchant() {
  if (merchantProcess && merchantProcess.exitCode === null) {
    const exited = once(merchantProcess, 'exit');
    merchantProcess.kill('SIGTERM');
    await exited;
  }
}
async function request(method, url, payload, authenticated = false) {
  const response = await app.inject({
    method,
    url,
    payload,
    headers: authenticated
      ? { authorization: 'Bearer ' + identities.apiKey }
      : {},
  });
  if (response.statusCode >= 300) throw Error(url + ': ' + response.body);
  return response.json();
}
async function advance(check, label) {
  for (let i = 0; i < 120; i++) {
    await worker.tick();
    if (check()) return;
    const failure = db
      .prepare("SELECT error FROM jobs WHERE status='failed' LIMIT 1")
      .get();
    if (failure) throw Error(label + ': ' + failure.error);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw Error(label + ': TIMEOUT_RESUME_FROM_DURABLE_STATE');
}
try {
  await startMerchant(true);
  const response = await fetch('http://127.0.0.1:4301/book', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderId: 'live-workshop-001' }),
  });
  assert.equal(response.status, 200);
  const order = await response.json();
  if (order.state === 'created') {
    const auth = await request(
      'POST',
      `/v1/checkouts/${order.id}/authorization`,
      { payer: buyer.address },
    );
    await request('POST', `/v1/checkouts/${order.id}/pay`, {
      payer: buyer.address,
      signature: await buyer.signTypedData(auth),
    });
  }
  await advance(
    () =>
      !!db
        .prepare(
          "SELECT 1 FROM chain_events WHERE checkout_id=? AND type='Paid'",
        )
        .get(order.id),
    'payment',
  );
  const payment = db
    .prepare("SELECT * FROM chain_events WHERE checkout_id=? AND type='Paid'")
    .get(order.id);
  console.log('Payment confirmed on Whitechain: ' + payment.tx_hash);
  const delivery = db
    .prepare('SELECT * FROM outbox WHERE id=?')
    .get(payment.id);
  if (delivery.status !== 'delivered') assert.equal(delivery.last_http, 503);
  await stopMerchant();
  await startMerchant(false);
  await request(
    'POST',
    `/v1/merchant/deliveries/${encodeURIComponent(payment.id)}/retry`,
    {},
    true,
  );
  await advance(
    () =>
      db.prepare('SELECT fulfillment FROM checkouts WHERE id=?').get(order.id)
        .fulfillment === 'fulfilled',
    'fulfillment',
  );
  await request(
    'POST',
    `/v1/merchant/deliveries/${encodeURIComponent(payment.id)}/retry`,
    {},
    true,
  );
  await worker.tick();
  const booking = await fetch(
    'http://127.0.0.1:4301/bookings/live-workshop-001',
  );
  assert.equal(booking.status, 200);
  const existingRefund = db
    .prepare(
      "SELECT * FROM chain_events WHERE checkout_id=? AND type='Refunded'",
    )
    .get(order.id);
  if (!existingRefund) {
    const refund = await request(
      'POST',
      `/v1/merchant/orders/${order.id}/refunds`,
      { refundId: 'live-refund-001', amount: '500000' },
      true,
    );
    await request(
      'POST',
      `/v1/merchant/refunds/${refund.id}/submit`,
      { signature: await merchant.signTypedData(refund.authorization) },
      true,
    );
  }
  await advance(
    () =>
      !!db
        .prepare(
          "SELECT 1 FROM chain_events WHERE checkout_id=? AND type='Refunded'",
        )
        .get(order.id),
    'refund',
  );
  const receipt = await request('GET', `/v1/checkouts/${order.id}`);
  const contractReceipt = await client.readContract({
    address: config.router,
    abi: config.abi,
    functionName: 'receipts',
    args: [onchainId(order.id)],
  });
  assert.equal(contractReceipt[2], 2000000n);
  assert.equal(contractReceipt[3], 500000n);
  const buyerWbt = await client.getBalance({ address: buyer.address }),
    merchantWbt = await client.getBalance({ address: merchant.address });
  assert.equal(buyerWbt, 0n);
  assert.equal(merchantWbt, 0n);
  const balance = (owner) =>
    client.readContract({
      address: REQUIRED_TOKEN,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner],
    });
  assert.equal(await balance(buyer.address), 1000000n);
  assert.equal(await balance(merchant.address), 1500000n);
  assert.equal(await balance(config.router), 0n);
  const result = {
    network: 'Whitechain Sepolia',
    chainId: 1874,
    token: REQUIRED_TOKEN,
    router: config.router,
    buyer: buyer.address,
    merchant: merchant.address,
    receipt,
    buyerWbt: '0',
    merchantWbt: '0',
    buyerUsdt: '1',
    merchantUsdt: '1.5',
    routerUsdt: '0',
    fundingTransaction: funding.transactionHash,
    checkedAt: new Date().toISOString(),
  };
  writeFileSync(directory + '/result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await stopMerchant();
  await app.close();
  db.close();
}
