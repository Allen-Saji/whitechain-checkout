import { transaction } from './db.mjs';
import { requireThat } from './api/validation.mjs';
import { relayScopeAllows } from './relay-scope.mjs';
const retryableErrors = new Set([
  'MERCHANT_GAS_BUDGET',
  'GLOBAL_GAS_BUDGET',
  'TRANSACTION_GAS_CAP',
  'SIMULATION_REVERTED',
]);
export function paymentRecovery(job, now = Math.floor(Date.now() / 1000)) {
  if (!job || job.status !== 'failed')
    return { retryable: false, reason: null };
  if (job.raw_tx || job.tx_hash)
    return { retryable: false, reason: 'TRANSACTION_REVIEW_REQUIRED' };
  if (job.deadline <= now)
    return { retryable: false, reason: 'AUTHORIZATION_EXPIRED' };
  return { retryable: retryableErrors.has(job.error), reason: job.error };
}
export function retryPayment(db, config, checkoutId, merchantId) {
  requireThat(config.relayEnabled !== false, 503, 'RELAYER_PAUSED');
  return transaction(db, () => {
    const c = db
      .prepare('SELECT * FROM checkouts WHERE id=? AND merchant_id=?')
      .get(checkoutId, merchantId);
    requireThat(c, 404, 'NOT_FOUND');
    requireThat(
      !db.prepare('SELECT halted FROM checkpoints WHERE id=1').get()?.halted,
      503,
      'CHAIN_REVIEW_REQUIRED',
    );
    requireThat(
      relayScopeAllows(config, { checkoutId, kind: 'pay', amount: c.amount }),
      503,
      'RELAY_SCOPE_RESTRICTED',
    );
    const job = db
      .prepare("SELECT * FROM jobs WHERE checkout_id=? AND kind='pay'")
      .get(checkoutId);
    requireThat(
      c.state === 'failed' && paymentRecovery(job).retryable,
      409,
      'PAYMENT_NOT_RETRYABLE',
    );
    db.prepare("UPDATE jobs SET status='queued',error=NULL WHERE id=?").run(
      job.id,
    );
    db.prepare("UPDATE checkouts SET state='queued' WHERE id=?").run(
      checkoutId,
    );
    return { jobId: job.id, status: 'queued' };
  });
}
