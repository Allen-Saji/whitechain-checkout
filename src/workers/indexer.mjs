import { transaction } from '../db.mjs';
import { onchainId } from '../protocol.mjs';
export function createIndexer(config, db, owns) {
  const client = config.client;
  async function index() {
    let checkpoint = db.prepare('SELECT * FROM checkpoints WHERE id=1').get();
    if (!checkpoint) {
      db.prepare('INSERT INTO checkpoints(id,block_number) VALUES(1,?)').run(
        config.deploymentBlock - 1,
      );
      checkpoint = db.prepare('SELECT * FROM checkpoints WHERE id=1').get();
    }
    if (checkpoint.halted) throw Error('CHAIN_REVIEW_REQUIRED');
    if (checkpoint.block_hash) {
      const block = await client.getBlock({
        blockNumber: BigInt(checkpoint.block_number),
      });
      if (!owns()) throw Error('WORKER_LEASE_LOST');
      if (block.hash !== checkpoint.block_hash) {
        db.prepare('UPDATE checkpoints SET halted=1 WHERE id=1').run();
        throw Error('CHAIN_REVIEW_REQUIRED');
      }
    }
    const head =
      Number(await client.getBlockNumber()) - config.confirmations + 1;
    const end = Math.min(head, checkpoint.block_number + 250);
    if (end <= checkpoint.block_number) return;
    const logs = await client.getContractEvents({
      address: config.router,
      abi: config.abi,
      fromBlock: BigInt(checkpoint.block_number + 1),
      toBlock: BigInt(end),
      strict: true,
    });
    const endBlock = await client.getBlock({ blockNumber: BigInt(end) });
    transaction(db, () => {
      if (!owns()) throw Error('WORKER_LEASE_LOST');
      for (const log of logs) {
        if (!['Paid', 'Refunded'].includes(log.eventName)) continue;
        const eventId = log.transactionHash + ':' + log.logIndex;
        if (db.prepare('SELECT 1 FROM chain_events WHERE id=?').get(eventId))
          continue;
        const job = db
          .prepare('SELECT * FROM jobs WHERE tx_hash=?')
          .get(log.transactionHash);
        if (!job) continue; // Only this service's known, immutable orders are fulfilled.
        const c = db
            .prepare('SELECT * FROM checkouts WHERE id=?')
            .get(job.checkout_id),
          m = db
            .prepare('SELECT * FROM merchants WHERE id=?')
            .get(c.merchant_id);
        const a = log.args;
        if (a.orderId !== onchainId(c.id) || a.amount !== BigInt(job.amount))
          throw Error('EVENT_TERMS_MISMATCH');
        if (log.eventName === 'Paid') {
          if (
            job.kind !== 'pay' ||
            a.buyer.toLowerCase() !== job.signer.toLowerCase() ||
            a.merchant.toLowerCase() !== m.payout.toLowerCase()
          )
            throw Error('EVENT_TERMS_MISMATCH');
          db.prepare(
            "UPDATE checkouts SET state='paid',buyer=? WHERE id=?",
          ).run(job.signer, c.id);
        } else {
          if (job.kind !== 'refund' || a.refundId !== onchainId(job.refund_id))
            throw Error('EVENT_TERMS_MISMATCH');
          const refunded = BigInt(c.refunded) + a.amount;
          if (refunded > BigInt(c.amount)) throw Error('REFUND_TOTAL_MISMATCH');
          db.prepare('UPDATE checkouts SET refunded=?,state=? WHERE id=?').run(
            refunded.toString(),
            refunded === BigInt(c.amount) ? 'refunded' : 'partially_refunded',
            c.id,
          );
          db.prepare("UPDATE refunds SET status='confirmed' WHERE id=?").run(
            job.refund_id,
          );
        }
        const payload = JSON.stringify({
          id: eventId,
          type:
            log.eventName === 'Paid' ? 'payment.confirmed' : 'refund.confirmed',
          checkoutId: c.id,
          orderId: c.external_id,
          amount: job.amount,
          transactionHash: log.transactionHash,
          chainId: 1874,
        });
        db.prepare('INSERT INTO chain_events VALUES(?,?,?,?,?,?,?)').run(
          eventId,
          c.id,
          log.eventName,
          log.transactionHash,
          Number(log.blockNumber),
          log.blockHash,
          payload,
        );
        db.prepare(
          'INSERT INTO outbox(id,merchant_id,checkout_id,payload,next_at,created_at) VALUES(?,?,?,?,?,?)',
        ).run(eventId, m.id, c.id, payload, Date.now(), Date.now());
        db.prepare(
          "UPDATE jobs SET status='confirmed',error=NULL WHERE id=?",
        ).run(job.id);
      }
      db.prepare(
        'UPDATE checkpoints SET block_number=?,block_hash=? WHERE id=1',
      ).run(end, endBlock.hash);
    });
  }
  return index;
}
