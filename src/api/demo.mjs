import { requireThat } from './validation.mjs';
/** Explicitly opt-in public view of one operator-owned test merchant. No mutation. */
export function registerDemoRoutes(app, config, db) {
  app.get('/v1/demo', async () => {
    requireThat(config.demoMerchantId, 404, 'DEMO_UNAVAILABLE');
    const m = db
      .prepare('SELECT id,payout FROM merchants WHERE id=?')
      .get(config.demoMerchantId);
    requireThat(m, 404, 'DEMO_UNAVAILABLE');
    return {
      merchant: m,
      readOnly: true,
      orders: db
        .prepare(
          'SELECT id,external_id,amount,expires_at,buyer,state,refunded,fulfillment,created_at FROM checkouts WHERE merchant_id=? ORDER BY created_at DESC LIMIT 25',
        )
        .all(m.id),
      deliveries: db
        .prepare(
          'SELECT id,checkout_id,status,attempts,next_at,last_http,last_error FROM outbox WHERE merchant_id=? ORDER BY created_at DESC LIMIT 50',
        )
        .all(m.id),
    };
  });
}
