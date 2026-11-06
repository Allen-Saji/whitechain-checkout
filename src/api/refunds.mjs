import { refundSummary } from '../refund-state.mjs';
import { relayScopeAllows } from '../relay-scope.mjs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { transaction } from '../db.mjs';
import { amount, requireThat, verifyAuthorization } from './validation.mjs';
import { authorization, refundNonce, jsonSafe } from '../protocol.mjs';
export function registerRefundRoutes(
  app,
  config,
  db,
  { merchant, checkout, available },
) {
  app.get('/v1/merchant/orders/:id/refunds', async (req) => {
    const m = merchant(req),
      c = checkout(req.params.id);
    requireThat(c.merchant_id === m.id, 404, 'NOT_FOUND');
    return refundSummary(db, c);
  });
  app.post('/v1/merchant/refunds/:id/cancel', async (req) => {
    const m = merchant(req);
    return transaction(db, () => {
      const r = db
        .prepare('SELECT * FROM refunds WHERE id=?')
        .get(req.params.id);
      requireThat(
        r && checkout(r.checkout_id).merchant_id === m.id,
        404,
        'NOT_FOUND',
      );
      requireThat(
        r.status === 'created' &&
          !db.prepare('SELECT id FROM jobs WHERE refund_id=?').get(r.id),
        409,
        'REFUND_NOT_CANCELLABLE',
      );
      db.prepare("UPDATE refunds SET status='cancelled' WHERE id=?").run(r.id);
      return { id: r.id, status: 'cancelled' };
    });
  });
  app.post('/v1/merchant/orders/:id/refunds', async (req) => {
    const m = merchant(req),
      c = checkout(req.params.id);
    requireThat(c.merchant_id === m.id, 404, 'NOT_FOUND');
    requireThat(
      ['paid', 'partially_refunded'].includes(c.state),
      409,
      'NOT_REFUNDABLE',
    );
    const input = z
      .object({ refundId: z.string().min(1).max(120), amount })
      .strict()
      .parse(req.body);
    const r = transaction(db, () => {
      const prior = db
        .prepare('SELECT * FROM refunds WHERE checkout_id=? AND external_id=?')
        .get(c.id, input.refundId);
      if (prior) {
        requireThat(prior.amount === input.amount, 409, 'REFUND_CONFLICT');
        return prior;
      }
      const current = checkout(c.id);
      const pending = BigInt(refundSummary(db, current).reserved);
      requireThat(
        BigInt(input.amount) + pending + BigInt(current.refunded) <=
          BigInt(c.amount),
        400,
        'OVER_REFUND',
      );
      const id = randomUUID(),
        deadline = Math.floor(Date.now() / 1000) + 900;
      db.prepare('INSERT INTO refunds VALUES(?,?,?,?,?,?)').run(
        id,
        c.id,
        input.refundId,
        input.amount,
        deadline,
        'created',
      );
      return db.prepare('SELECT * FROM refunds WHERE id=?').get(id);
    });
    return {
      id: r.id,
      authorization: jsonSafe(
        authorization(
          config,
          c.payout,
          r.amount,
          r.deadline,
          refundNonce(
            config.router,
            c.id,
            r.id,
            c.payout,
            c.buyer,
            r.amount,
            r.deadline,
          ),
        ),
      ),
    };
  });
  app.post('/v1/merchant/refunds/:id/submit', async (req) => {
    requireThat(config.relayEnabled !== false, 503, 'RELAYER_PAUSED');
    available();
    const m = merchant(req);
    const r = db.prepare('SELECT * FROM refunds WHERE id=?').get(req.params.id);
    requireThat(r, 404, 'NOT_FOUND');
    const c = checkout(r.checkout_id);
    requireThat(
      ['created', 'queued', 'confirmed'].includes(r.status),
      409,
      'REFUND_UNAVAILABLE',
    );
    requireThat(
      relayScopeAllows(config, {
        checkoutId: c.id,
        kind: 'refund',
        amount: r.amount,
      }),
      503,
      'RELAY_SCOPE_RESTRICTED',
    );
    requireThat(c.merchant_id === m.id, 404, 'NOT_FOUND');
    const { signature } = z
      .object({ signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/) })
      .strict()
      .parse(req.body);
    requireThat(
      r.deadline > Math.floor(Date.now() / 1000),
      409,
      'REFUND_EXPIRED',
    );
    const auth = authorization(
      config,
      c.payout,
      r.amount,
      r.deadline,
      refundNonce(
        config.router,
        c.id,
        r.id,
        c.payout,
        c.buyer,
        r.amount,
        r.deadline,
      ),
    );
    requireThat(
      await verifyAuthorization({ ...auth, address: c.payout, signature }),
      401,
      'INVALID_SIGNATURE',
    );
    return transaction(db, () => {
      const current = db
        .prepare('SELECT status,deadline FROM refunds WHERE id=?')
        .get(r.id);
      requireThat(
        ['created', 'queued', 'confirmed'].includes(current.status),
        409,
        'REFUND_UNAVAILABLE',
      );
      requireThat(
        current.deadline > Math.floor(Date.now() / 1000),
        409,
        'REFUND_EXPIRED',
      );
      const prior = db
        .prepare('SELECT id,status FROM jobs WHERE refund_id=?')
        .get(r.id);
      if (prior) return prior;
      const id = randomUUID();
      db.prepare(
        'INSERT INTO jobs(id,checkout_id,kind,refund_id,amount,deadline,signer,signature,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
      ).run(
        id,
        c.id,
        'refund',
        r.id,
        r.amount,
        r.deadline,
        c.payout,
        signature,
        Date.now(),
      );
      db.prepare("UPDATE refunds SET status='queued' WHERE id=?").run(r.id);
      return { id, status: 'queued' };
    });
  });
}
