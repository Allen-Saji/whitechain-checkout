import { randomBytes, randomUUID } from 'node:crypto';
import { verifyMessage } from 'viem';
import { z } from 'zod';
import { hash, webhookSignature } from '../crypto.mjs';
import { transaction } from '../db.mjs';
import { webhookUrl, createWebhookFetcher } from '../http/webhook.mjs';
import {
  issueSession,
  requireSameOrigin,
  sessionMerchant,
} from './sessions.mjs';
import { address, requireThat } from './validation.mjs';
const name = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .refine((value) =>
    [...value].every((character) => {
      const code = character.codePointAt(0);
      return code >= 32 && code !== 127 && code !== 0x2028 && code !== 0x2029;
    }),
  );
export function registerOnboardingRoutes(
  app,
  config,
  db,
  { webhookFetcher } = {},
) {
  const origin = config.appOrigin ?? 'http://127.0.0.1:4210';
  const fetcher =
    webhookFetcher ?? createWebhookFetcher({ local: config.local });
  const owner = (req) => {
    const m = sessionMerchant(req, { appOrigin: origin }, db);
    requireThat(m, 401, 'SIGN_IN_REQUIRED');
    return m;
  };
  function profile(m) {
    const p = db
      .prepare('SELECT * FROM merchant_profiles WHERE merchant_id=?')
      .get(m.id);
    return {
      id: m.id,
      payout: m.payout,
      businessName: p?.business_name ?? '',
      webhookUrl: m.webhook_url,
      webhookVerifiedAt: p?.webhook_verified_at ?? null,
      webhookCheckedAt: p?.webhook_checked_at ?? null,
      webhookLastHttp: p?.webhook_last_http ?? null,
      webhookLastError: p?.webhook_last_error ?? null,
      dailyGasBudget: m.daily_gas_budget,
    };
  }
  app.post('/v1/registration/challenge', async (req) => {
    requireSameOrigin(req, { appOrigin: origin });
    requireThat(
      config.registrationEnabled === true,
      403,
      'REGISTRATION_DISABLED',
    );
    const input = z
      .object({ address, businessName: name })
      .strict()
      .parse(req.body);
    requireThat(
      !db
        .prepare('SELECT 1 FROM merchants WHERE lower(payout)=lower(?)')
        .get(input.address),
      409,
      'MERCHANT_ALREADY_REGISTERED',
    );
    const id = randomBytes(16).toString('hex'),
      now = Date.now(),
      expiresAt = now + 300000;
    const message = `${new URL(origin).host} requests a merchant account registration.\n\nBusiness: ${input.businessName}\nPayout wallet: ${input.address}\n\nCreate a Checkout merchant account for this wallet. This does not approve token spending.\n\nURI: ${origin}\nChain ID: 1874\nNonce: ${id}\nIssued At: ${new Date(now).toISOString()}\nExpiration Time: ${new Date(expiresAt).toISOString()}`;
    db.prepare('DELETE FROM registration_challenges WHERE expires_at<?').run(
      now,
    );
    db.prepare(
      'INSERT INTO registration_challenges(id,address,business_name,message,expires_at) VALUES(?,?,?,?,?)',
    ).run(id, input.address, input.businessName, message, expiresAt);
    return { id, message, expiresAt };
  });
  app.post('/v1/registration/verify', async (req, reply) => {
    requireSameOrigin(req, { appOrigin: origin });
    requireThat(
      config.registrationEnabled === true,
      403,
      'REGISTRATION_DISABLED',
    );
    const input = z
      .object({
        id: z.string().regex(/^[a-f0-9]{32}$/),
        signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
      })
      .strict()
      .parse(req.body);
    const challenge = db
      .prepare('SELECT * FROM registration_challenges WHERE id=?')
      .get(input.id);
    requireThat(
      challenge && !challenge.used && challenge.expires_at > Date.now(),
      401,
      'CHALLENGE_EXPIRED',
    );
    let valid = false;
    try {
      valid = await verifyMessage({
        address: challenge.address,
        message: challenge.message,
        signature: input.signature,
      });
    } catch {
      /* Fail closed for malformed signatures. */
    }
    requireThat(valid, 401, 'INVALID_SIGNATURE');
    const apiKey = randomBytes(32).toString('hex'),
      webhookSecret = randomBytes(32).toString('hex');
    const m = transaction(db, () => {
      const consumed = db
        .prepare(
          'UPDATE registration_challenges SET used=1 WHERE id=? AND used=0 AND expires_at>?',
        )
        .run(input.id, Date.now());
      requireThat(consumed.changes === 1, 401, 'CHALLENGE_EXPIRED');
      requireThat(
        !db
          .prepare('SELECT 1 FROM merchants WHERE lower(payout)=lower(?)')
          .get(challenge.address),
        409,
        'MERCHANT_ALREADY_REGISTERED',
      );
      const id = randomUUID();
      db.prepare('INSERT INTO merchants VALUES(?,?,?,?,?,?)').run(
        id,
        challenge.address,
        hash(apiKey),
        '',
        webhookSecret,
        config.registrationDailyGasBudget ?? '1000000000000000',
      );
      db.prepare(
        'INSERT INTO merchant_profiles(merchant_id,business_name) VALUES(?,?)',
      ).run(id, challenge.business_name);
      issueSession(db, req, reply, origin, id);
      return db.prepare('SELECT * FROM merchants WHERE id=?').get(id);
    });
    return { merchant: profile(m), credentials: { apiKey, webhookSecret } };
  });
  app.get('/v1/merchant/settings', async (req) => profile(owner(req)));
  app.post('/v1/merchant/settings', async (req) => {
    const m = owner(req),
      input = z
        .object({ businessName: name, webhookUrl: z.string().max(2000) })
        .strict()
        .parse(req.body);
    let url;
    try {
      url = webhookUrl(input.webhookUrl, { local: config.local }).href;
    } catch {
      requireThat(false, 400, 'PUBLIC_HTTPS_WEBHOOK_REQUIRED');
    }
    transaction(db, () => {
      db.prepare('UPDATE merchants SET webhook_url=? WHERE id=?').run(
        url,
        m.id,
      );
      db.prepare(
        `INSERT INTO merchant_profiles(merchant_id,business_name) VALUES(?,?) ON CONFLICT(merchant_id) DO UPDATE SET business_name=excluded.business_name,webhook_verified_at=NULL,webhook_checked_at=NULL,webhook_last_http=NULL,webhook_last_error=NULL,settings_version=settings_version+1`,
      ).run(m.id, input.businessName);
    });
    return profile(db.prepare('SELECT * FROM merchants WHERE id=?').get(m.id));
  });
  app.post('/v1/merchant/credentials/rotate', async (req) => {
    const m = owner(req),
      input = z
        .object({ credential: z.enum(['apiKey', 'webhookSecret']) })
        .strict()
        .parse(req.body);
    const value = randomBytes(32).toString('hex');
    transaction(db, () => {
      if (input.credential === 'apiKey')
        db.prepare('UPDATE merchants SET api_hash=? WHERE id=?').run(
          hash(value),
          m.id,
        );
      else {
        db.prepare('UPDATE merchants SET webhook_secret=? WHERE id=?').run(
          value,
          m.id,
        );
        db.prepare(
          'UPDATE merchant_profiles SET webhook_verified_at=NULL,settings_version=settings_version+1 WHERE merchant_id=?',
        ).run(m.id);
      }
    });
    return { credential: input.credential, value };
  });
  app.post('/v1/merchant/webhook/check', async (req) => {
    const m = owner(req),
      p = db
        .prepare('SELECT * FROM merchant_profiles WHERE merchant_id=?')
        .get(m.id);
    requireThat(p && m.webhook_url, 409, 'WEBHOOK_NOT_CONFIGURED');
    const now = Date.now();
    // Persist the cooldown before I/O to prevent concurrent requests bypassing it.
    const reserved = db
      .prepare(
        'UPDATE merchant_profiles SET webhook_checked_at=? WHERE merchant_id=? AND (webhook_checked_at IS NULL OR webhook_checked_at<?)',
      )
      .run(now, m.id, now - 30000);
    requireThat(reserved.changes === 1, 429, 'WEBHOOK_CHECK_COOLDOWN');
    const timestamp = String(Math.floor(now / 1000)),
      body = JSON.stringify({
        id: randomUUID(),
        type: 'integration.check',
        merchantId: m.id,
        createdAt: now,
      });
    let status = null,
      error = null;
    try {
      const response = await fetcher(m.webhook_url, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        headers: {
          'content-type': 'application/json',
          'x-checkout-timestamp': timestamp,
          'x-checkout-signature': webhookSignature(
            m.webhook_secret,
            timestamp,
            body,
          ),
        },
        body,
      });
      status = response.status;
      await response.body?.cancel();
      if (status < 200 || status >= 300) error = 'WEBHOOK_HTTP_ERROR';
    } catch {
      error = 'WEBHOOK_CONNECTION_FAILED';
    }
    const changed = db
      .prepare(
        'UPDATE merchant_profiles SET webhook_verified_at=?,webhook_last_http=?,webhook_last_error=? WHERE merchant_id=? AND settings_version=? AND webhook_checked_at=?',
      )
      .run(
        error ? null : Date.now(),
        status,
        error,
        m.id,
        p.settings_version,
        now,
      );
    requireThat(changed.changes === 1, 409, 'SETTINGS_CHANGED');
    return profile(db.prepare('SELECT * FROM merchants WHERE id=?').get(m.id));
  });
}
