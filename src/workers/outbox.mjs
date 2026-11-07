import { webhookSignature } from '../crypto.mjs';
export function createOutbox(db, owns, fetcher) {
  async function deliver() {
    const rows = db
      .prepare(
        "SELECT o.*,m.webhook_url,m.webhook_secret FROM outbox o JOIN merchants m ON m.id=o.merchant_id WHERE o.status='pending' AND o.next_at<=? ORDER BY o.created_at LIMIT 10",
      )
      .all(Date.now());
    const results = await Promise.allSettled(
      rows.map(async (row) => {
        if (!owns()) throw Error('WORKER_LEASE_LOST');
        const timestamp = String(Math.floor(Date.now() / 1000));
        let status = null,
          error = null;
        try {
          const response = await fetcher(row.webhook_url, {
            method: 'POST',
            redirect: 'error',
            signal: AbortSignal.timeout(5000),
            headers: {
              'content-type': 'application/json',
              'x-checkout-timestamp': timestamp,
              'x-checkout-signature': webhookSignature(
                row.webhook_secret,
                timestamp,
                row.payload,
              ),
            },
            body: row.payload,
          });
          status = response.status;
          await response.body?.cancel();
        } catch {
          error = 'DELIVERY_FAILED';
        }
        if (!owns()) throw Error('WORKER_LEASE_LOST');
        const delivered = status >= 200 && status < 300,
          attempts = row.attempts + 1;
        db.prepare(
          'UPDATE outbox SET status=?,attempts=?,next_at=?,last_http=?,last_error=? WHERE id=?',
        ).run(
          delivered ? 'delivered' : 'pending',
          attempts,
          Date.now() + Math.min(300000, 1000 * 2 ** Math.min(attempts, 8)),
          status,
          error ?? (delivered ? null : 'HTTP_ERROR'),
          row.id,
        );
      }),
    );
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
  }
  return deliver;
}
