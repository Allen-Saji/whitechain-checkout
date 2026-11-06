import { registerSessionRoutes } from './api/sessions.mjs';
import { registerDemoRoutes } from './api/demo.mjs';
import { REQUIRED_TOKEN } from './protocol.mjs';
import Fastify from 'fastify';
import { z } from 'zod';
import { createApiContext } from './api/context.mjs';
import { registerCheckoutRoutes } from './api/checkouts.mjs';
import { registerMerchantRoutes } from './api/merchant.mjs';
import { registerRefundRoutes } from './api/refunds.mjs';
export function buildApi(config, db) {
  const app = Fastify({ logger: false, bodyLimit: 16000 });
  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('cache-control', 'no-store');
    return payload;
  });
  const limits = new Map();
  app.addHook('onRequest', async (req, reply) => {
    const now = Date.now();
    let bucket = limits.get(req.ip);
    if (!bucket || bucket.until <= now) {
      for (const [ip, value] of limits)
        if (value.until <= now) limits.delete(ip);
      if (limits.size >= 10000 && !limits.has(req.ip))
        return reply.code(429).send({ error: { code: 'RATE_LIMITED' } });
      bucket = { until: now + 60000, count: 0 };
      limits.set(req.ip, bucket);
    }
    if (++bucket.count > 120)
      return reply
        .code(429)
        .header('retry-after', String(Math.ceil((bucket.until - now) / 1000)))
        .send({ error: { code: 'RATE_LIMITED' } });
  });
  app.setErrorHandler((error, req, reply) =>
    reply
      .code(error instanceof z.ZodError ? 400 : (error.statusCode ?? 500))
      .send({
        error: {
          code:
            error instanceof z.ZodError
              ? 'INVALID_INPUT'
              : error.statusCode
                ? error.code
                : 'INTERNAL_ERROR',
        },
      }),
  );
  app.get('/health', async () => ({
    ok: true,
    network: config.local ? 'local-fork' : 'whitechain-sepolia',
    workerHalted: !!db
      .prepare('SELECT halted FROM checkpoints WHERE id=1')
      .get()?.halted,
  }));
  app.get('/v1/config', async () => ({
    relayEnabled: config.relayEnabled !== false,
    chainId: 1874,
    token: REQUIRED_TOKEN,
    tokenName: config.tokenName ?? 'Tether USD',
    decimals: 6,
    router: config.router,
    local: config.local,
    explorerUrl: config.local ? null : 'https://explorer.testnet.whitechain.io',
    rpcUrl: config.rpc,
    appOrigin: config.appOrigin,
  }));
  registerSessionRoutes(app, config, db);
  registerDemoRoutes(app, config, db);
  const context = createApiContext(db, config);
  registerCheckoutRoutes(app, config, db, context);
  registerMerchantRoutes(app, db, context);
  registerRefundRoutes(app, config, db, context);
  return app;
}
