import 'dotenv/config';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
if (
  !process.env.DB_PATH ||
  !process.env.DEMO_MERCHANT_ID ||
  !process.env.MERCHANT_CONFIG ||
  !process.env.BOOKING_DB
)
  throw Error(
    'Set DB_PATH, DEMO_MERCHANT_ID, MERCHANT_CONFIG and BOOKING_DB for the operator-provisioned demo merchant.',
  );
if (!existsSync(process.env.MERCHANT_CONFIG))
  throw Error('MERCHANT_CONFIG_MISSING');
const environment = {
  ...process.env,
  PORT: '4200',
  BOOKING_PORT: '4301',
  CHECKOUT_API: 'http://127.0.0.1:4200',
  APP_ORIGIN: process.env.APP_ORIGIN ?? 'http://127.0.0.1:4210',
  CHECKOUT_BASE_URL: 'http://127.0.0.1:4210/checkout',
};
const children = [];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
}
for (const args of [
  ['src/server.mjs'],
  ...(process.env.DEMO_WORKER === '0' ? [] : [['src/worker.mjs']]),
  ['examples/booking/server.mjs'],
]) {
  const child = spawn(process.execPath, args, {
    env: environment,
    stdio: 'inherit',
  });
  children.push(child);
  child.on('error', () => {
    console.error('A demo service could not start.');
    process.exitCode = 1;
    stop();
  });
  child.on('exit', (code) => {
    if (!stopping) {
      process.exitCode = code || 1;
      stop();
    }
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
console.log(
  `Starting API and booking service${process.env.DEMO_WORKER === '0' ? ' (relayer paused)' : ' with relayer'}. Run pnpm dev:web separately.`,
);
