import { paymentRecovery, retryPayment } from '../recovery.mjs';
import { z } from 'zod';
import { requireThat } from './validation.mjs';
export function registerMerchantRoutes(
  app,
  db,
  { merchant, checkout },
  config = {},
) {
  app.get('/v1/merchant/orders', async (req) => {
    const m = merchant(req);
    return {
      orders: db
        .prepare(
          'SELECT c.*,d.title,d.description,d.merchant_name FROM checkouts c LEFT JOIN checkout_details d ON d.checkout_id=c.id WHERE c.merchant_id=? ORDER BY c.created_at DESC LIMIT 100',
        )
        .all(m.id)
        .map((order) => {
          const job = db
            .prepare("SELECT * FROM jobs WHERE checkout_id=? AND kind='pay'")
            .get(order.id);
          return {
            ...order,
            recovery: paymentRecovery(job),
            paymentError: job?.error ?? null,
          };
        }),
    };
  });
  app.post('/v1/merchant/orders/:id/retry-payment', async (req) =>
    retryPayment(db, config, req.params.id, merchant(req).id),
  );
  app.get('/v1/merchant/deliveries', async (req) => {
    const m = merchant(req);
    return {
      deliveries: db
        .prepare(
          'SELECT id,checkout_id,status,attempts,next_at,last_http,last_error FROM outbox WHERE merchant_id=? ORDER BY created_at DESC LIMIT 100',
        )
        .all(m.id),
    };
  });
  app.post('/v1/merchant/deliveries/:id/retry', async (req) => {
    const m = merchant(req);
    const r = db
      .prepare(
        "UPDATE outbox SET status='pending',next_at=? WHERE id=? AND merchant_id=?",
      )
      .run(Date.now(), req.params.id, m.id);
    requireThat(r.changes, 404, 'NOT_FOUND');
    return { queued: true };
  });
  app.post('/v1/merchant/orders/:id/fulfillment', async (req) => {
    const m = merchant(req),
      c = checkout(req.params.id);
    requireThat(c.merchant_id === m.id, 404, 'NOT_FOUND');
    const { state } = z
      .object({ state: z.enum(['fulfilled', 'unavailable']) })
      .strict()
      .parse(req.body);
    requireThat(
      ['paid', 'partially_refunded', 'refunded'].includes(c.state),
      409,
      'NOT_PAID',
    );
    db.prepare('UPDATE checkouts SET fulfillment=? WHERE id=?').run(
      state,
      c.id,
    );
    return { id: c.id, fulfillment: state };
  });
}
