import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { getAddress } from 'viem';
import { loadConfig } from '../src/config.mjs';
import { openDatabase } from '../src/db.mjs';
import { hash } from '../src/crypto.mjs';
const [payoutInput, webhookInput] = process.argv.slice(2);
if (!payoutInput || !webhookInput)
  throw Error(
    'Usage: node scripts/create-merchant.mjs PAYOUT_ADDRESS WEBHOOK_URL',
  );
const config = await loadConfig(),
  payout = getAddress(payoutInput),
  webhook = new URL(webhookInput);
if (webhook.username || webhook.password || webhook.hash)
  throw Error('INVALID_WEBHOOK_URL');
if (config.local) {
  if (
    webhook.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(webhook.hostname)
  )
    throw Error('LOCAL_WEBHOOK_REQUIRED');
} else if (webhook.protocol !== 'https:') throw Error('HTTPS_WEBHOOK_REQUIRED');
const path = config.local
  ? '.local/merchant-fork.json'
  : '.local/merchant-testnet.json';
if (existsSync(path)) throw Error('MERCHANT_FILE_EXISTS');
const credentials = {
  id: randomUUID(),
  payout,
  apiKey: randomBytes(32).toString('hex'),
  webhookSecret: randomBytes(32).toString('hex'),
  webhookUrl: webhook.href,
};
writeFileSync(path, JSON.stringify(credentials, null, 2), {
  flag: 'wx',
  mode: 0o600,
});
const db = openDatabase(config.dbPath);
try {
  db.prepare('INSERT INTO merchants VALUES(?,?,?,?,?,?)').run(
    credentials.id,
    payout,
    hash(credentials.apiKey),
    webhook.href,
    credentials.webhookSecret,
    '50000000000000000',
  );
} finally {
  db.close();
}
console.log(
  'Merchant configured. Credentials saved locally to ' +
    path +
    '; not printed.',
);
