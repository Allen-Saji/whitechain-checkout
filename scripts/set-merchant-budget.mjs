import { openDatabase } from '../src/db.mjs';
const [merchantId, amount, mode] = process.argv.slice(2);
if (
  !merchantId ||
  !/^[0-9]+$/.test(amount ?? '') ||
  (mode && mode !== '--apply')
) {
  console.error(
    'Usage: DB_PATH=/data/checkout.sqlite node scripts/set-merchant-budget.mjs MERCHANT_ID WEI [--apply]',
  );
  process.exit(1);
}
if (!process.env.DB_PATH) throw Error('Set DB_PATH explicitly');
const db = openDatabase(process.env.DB_PATH);
try {
  const m = db
    .prepare('SELECT id,daily_gas_budget FROM merchants WHERE id=?')
    .get(merchantId);
  if (!m) throw Error('Merchant not found');
  if (
    BigInt(amount) >
    BigInt(process.env.GLOBAL_DAILY_GAS_BUDGET ?? '50000000000000000')
  )
    throw Error('Merchant allowance exceeds configured global cap');
  if (mode === '--apply')
    db.prepare('UPDATE merchants SET daily_gas_budget=? WHERE id=?').run(
      amount,
      merchantId,
    );
  console.log(
    JSON.stringify({
      merchantId,
      previous: m.daily_gas_budget,
      proposed: amount,
      applied: mode === '--apply',
    }),
  );
} finally {
  db.close();
}
