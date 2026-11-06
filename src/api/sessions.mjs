import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { verifyMessage } from 'viem';
import { hash } from '../crypto.mjs';
import { transaction } from '../db.mjs';
import { address, requireThat } from './validation.mjs';
const COOKIE = 'checkout_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
export function sessionToken(req) {
  return req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(COOKIE + '='))
    ?.slice(COOKIE.length + 1);
}
export function requireSameOrigin(req, config) {
  requireThat(
    req.headers.origin === config.appOrigin,
    403,
    'ORIGIN_NOT_ALLOWED',
  );
}
export function sessionMerchant(req, config, db) {
  const token = sessionToken(req);
  if (!token) return null;
  if (!['GET', 'HEAD'].includes(req.method)) requireSameOrigin(req, config);
  return db
    .prepare(
      'SELECT m.* FROM merchants m JOIN merchant_sessions s ON s.merchant_id=m.id WHERE s.token_hash=? AND s.expires_at>?',
    )
    .get(hash(token), Date.now());
}
export function issueSession(db, req, reply, origin, merchantId) {
  const token = randomBytes(32).toString('hex');
  const old = sessionToken(req);
  if (old)
    db.prepare('DELETE FROM merchant_sessions WHERE token_hash=?').run(
      hash(old),
    );
  db.prepare('INSERT INTO merchant_sessions VALUES(?,?,?)').run(
    hash(token),
    merchantId,
    Date.now() + SESSION_SECONDS * 1000,
  );
  reply.header(
    'set-cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${origin.startsWith('https:') ? '; Secure' : ''}`,
  );
}
export function registerSessionRoutes(app, config, db) {
  const origin = config.appOrigin ?? 'http://127.0.0.1:4210';
  const cookie = (token, maxAge) =>
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${origin.startsWith('https:') ? '; Secure' : ''}`;
  app.post('/v1/session/challenge', async (req) => {
    requireSameOrigin(req, { appOrigin: origin });
    const input = z.object({ address }).strict().parse(req.body);
    const now = Date.now();
    db.prepare('DELETE FROM auth_challenges WHERE expires_at<?').run(now);
    db.prepare('DELETE FROM merchant_sessions WHERE expires_at<?').run(now);
    const id = randomBytes(16).toString('hex'),
      expiresAt = now + 300000;
    const message = `${new URL(origin).host} wants you to sign in with your Ethereum account:\n${input.address}\n\nSign in to your Checkout merchant workspace. This does not approve a payment or token allowance.\n\nURI: ${origin}\nVersion: 1\nChain ID: 1874\nNonce: ${id}\nIssued At: ${new Date(now).toISOString()}\nExpiration Time: ${new Date(expiresAt).toISOString()}`;
    db.prepare(
      'INSERT INTO auth_challenges(id,address,message,expires_at) VALUES(?,?,?,?)',
    ).run(id, input.address, message, expiresAt);
    return { id, message, expiresAt };
  });
  app.post('/v1/session/verify', async (req, reply) => {
    requireSameOrigin(req, { appOrigin: origin });
    const input = z
      .object({
        id: z.string().regex(/^[a-f0-9]{32}$/),
        signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
      })
      .strict()
      .parse(req.body);
    const challenge = db
      .prepare('SELECT * FROM auth_challenges WHERE id=?')
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
      /* Malformed signatures are authentication failures. */
    }
    requireThat(valid, 401, 'INVALID_SIGNATURE');
    const merchant = transaction(db, () => {
      const changed = db
        .prepare(
          'UPDATE auth_challenges SET used=1 WHERE id=? AND used=0 AND expires_at>?',
        )
        .run(challenge.id, Date.now());
      requireThat(changed.changes === 1, 401, 'CHALLENGE_EXPIRED');
      const m = db
        .prepare(
          'SELECT * FROM merchants WHERE lower(payout)=lower(?) ORDER BY id LIMIT 1',
        )
        .get(challenge.address);
      requireThat(m, 403, 'MERCHANT_NOT_REGISTERED');
      issueSession(db, req, reply, origin, m.id);
      return m;
    });
    return {
      merchant: { id: merchant.id, payout: merchant.payout },
      expiresIn: SESSION_SECONDS,
    };
  });
  app.get('/v1/session', async (req, reply) => {
    reply.header('cache-control', 'no-store');
    const m = sessionMerchant(req, { appOrigin: origin }, db);
    requireThat(m, 401, 'SIGN_IN_REQUIRED');
    return { merchant: { id: m.id, payout: m.payout } };
  });
  app.post('/v1/session/logout', async (req, reply) => {
    requireSameOrigin(req, { appOrigin: origin });
    const token = sessionToken(req);
    if (token)
      db.prepare('DELETE FROM merchant_sessions WHERE token_hash=?').run(
        hash(token),
      );
    reply.header('set-cookie', cookie('', 0));
    return { signedOut: true };
  });
}
