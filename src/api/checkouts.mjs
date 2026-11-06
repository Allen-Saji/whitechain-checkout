import { relayScopeAllows } from '../relay-scope.mjs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { transaction } from '../db.mjs';
import {
  address,
  amount,
  requireThat,
  verifyAuthorization,
} from './validation.mjs';
import {
  authorization,
  paymentNonce,
  jsonSafe,
  REQUIRED_TOKEN,
} from '../protocol.mjs';
export function registerCheckoutRoutes(
  app,
  config,
  db,
  { merchant, checkout, available },
) {
  const publicOrder = (c) => ({
    id: c.id,
    checkoutUrl: config.checkoutBaseUrl
      ? config.checkoutBaseUrl.replace(/\/$/, '') + '/' + c.id
      : null,
    orderId: c.external_id,
    amount: c.amount,
    title: c.title ?? 'Order',
    description: c.description ?? '',
    merchantName: c.merchant_name ?? 'Merchant',
    merchant: c.payout,
    buyer: c.buyer,
    state: c.state,
    refunded: c.refunded,
    fulfillment: c.fulfillment,
    expiresAt: c.expires_at,
    chainId: 1874,
    token: REQUIRED_TOKEN,
  });
  const typed = (c, payer) =>
    authorization(
      config,
      payer,
      c.amount,
      c.expires_at,
      paymentNonce(
        config.router,
        c.id,
        payer,
        c.payout,
        c.amount,
        c.expires_at,
      ),
    );
  app.post('/v1/checkouts', async (req, reply) => {
    const m = merchant(req);
    const profile = db
      .prepare(
        'SELECT webhook_verified_at,business_name FROM merchant_profiles WHERE merchant_id=?',
      )
      .get(m.id);
    requireThat(
      !profile || profile.webhook_verified_at,
      409,
      'INTEGRATION_NOT_READY',
    );
    available();
    const input = z
      .object({
        title: z.string().trim().min(1).max(120).default('Order'),
        description: z.string().trim().max(500).default(''),
        orderId: z.string().min(1).max(120),
        amount,
        expiresIn: z.number().int().min(60).max(3600).default(900),
      })
      .strict()
      .parse(req.body);
    const id = transaction(db, () => {
      const prior = db
        .prepare(
          'SELECT * FROM checkouts WHERE merchant_id=? AND external_id=?',
        )
        .get(m.id, input.orderId);
      if (prior) {
        requireThat(prior.amount === input.amount, 409, 'ORDER_CONFLICT');
        const details = db
          .prepare(
            'SELECT title,description FROM checkout_details WHERE checkout_id=?',
          )
          .get(prior.id);
        requireThat(
          (details?.title ?? 'Order') === input.title &&
            (details?.description ?? '') === input.description,
          409,
          'ORDER_CONFLICT',
        );
        return prior.id;
      }
      const id = randomUUID();
      db.prepare(
        'INSERT INTO checkouts(id,merchant_id,external_id,amount,expires_at,created_at) VALUES(?,?,?,?,?,?)',
      ).run(
        id,
        m.id,
        input.orderId,
        input.amount,
        Math.floor(Date.now() / 1000) + input.expiresIn,
        Date.now(),
      );
      db.prepare(
        'INSERT INTO checkout_details(checkout_id,title,description,merchant_name) VALUES(?,?,?,?)',
      ).run(
        id,
        input.title,
        input.description,
        profile?.business_name ?? 'Merchant',
      );
      return id;
    });
    return reply.code(201).send({
      id,
      checkoutUrl: config.checkoutBaseUrl
        ? config.checkoutBaseUrl.replace(/\/$/, '') + '/' + id
        : null,
      ...publicOrder(checkout(id)),
    });
  });
  app.get('/v1/checkouts/:id', async (req) => {
    const c = checkout(req.params.id);
    return {
      ...publicOrder(c),
      paymentJob:
        db
          .prepare(
            "SELECT status,error,tx_hash AS transactionHash FROM jobs WHERE checkout_id=? AND kind='pay'",
          )
          .get(c.id) ?? null,
      timeline: db
        .prepare(
          'SELECT type,tx_hash AS transactionHash,block_number AS blockNumber FROM chain_events WHERE checkout_id=? ORDER BY block_number,id',
        )
        .all(c.id),
    };
  });
  app.post('/v1/checkouts/:id/authorization', async (req) => {
    requireThat(config.relayEnabled !== false, 503, 'RELAYER_PAUSED');
    available();
    const c = checkout(req.params.id);
    requireThat(
      relayScopeAllows(config, {
        checkoutId: c.id,
        kind: 'pay',
        amount: c.amount,
      }),
      503,
      'RELAY_SCOPE_RESTRICTED',
    );
    const { payer } = z.object({ payer: address }).strict().parse(req.body);
    requireThat(
      c.state === 'created' && c.expires_at > Math.floor(Date.now() / 1000),
      409,
      'CHECKOUT_UNAVAILABLE',
    );
    return jsonSafe(typed(c, payer));
  });
  app.post('/v1/checkouts/:id/pay', async (req) => {
    requireThat(config.relayEnabled !== false, 503, 'RELAYER_PAUSED');
    available();
    const c = checkout(req.params.id);
    requireThat(
      relayScopeAllows(config, {
        checkoutId: c.id,
        kind: 'pay',
        amount: c.amount,
      }),
      503,
      'RELAY_SCOPE_RESTRICTED',
    );
    const input = z
      .object({
        payer: address,
        signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
      })
      .strict()
      .parse(req.body);
    requireThat(
      c.expires_at > Math.floor(Date.now() / 1000),
      409,
      'CHECKOUT_EXPIRED',
    );
    requireThat(
      input.payer.toLowerCase() !== c.payout.toLowerCase(),
      400,
      'SELF_PAYMENT',
    );
    requireThat(
      await verifyAuthorization({
        ...typed(c, input.payer),
        address: input.payer,
        signature: input.signature,
      }),
      401,
      'INVALID_SIGNATURE',
    );
    return transaction(db, () => {
      const prior = db
        .prepare("SELECT * FROM jobs WHERE checkout_id=? AND kind='pay'")
        .get(c.id);
      if (prior) {
        requireThat(prior.signer === input.payer, 409, 'PAYER_CONFLICT');
        return {
          jobId: prior.id,
          status: prior.status,
          transactionHash: prior.tx_hash,
        };
      }
      requireThat(
        checkout(c.id).state === 'created',
        409,
        'CHECKOUT_UNAVAILABLE',
      );
      const id = randomUUID();
      db.prepare(
        'INSERT INTO jobs(id,checkout_id,kind,amount,deadline,signer,signature,created_at) VALUES(?,?,?,?,?,?,?,?)',
      ).run(
        id,
        c.id,
        'pay',
        c.amount,
        c.expires_at,
        input.payer,
        input.signature,
        Date.now(),
      );
      db.prepare("UPDATE checkouts SET buyer=?,state='queued' WHERE id=?").run(
        input.payer,
        c.id,
      );
      return { jobId: id, status: 'queued' };
    });
  });
}
