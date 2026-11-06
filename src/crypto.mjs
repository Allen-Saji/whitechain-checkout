import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export const webhookSignature = (secret, timestamp, body) =>
  createHmac('sha256', secret)
    .update(timestamp + '.' + body)
    .digest('hex');
export function verifyWebhook(
  secret,
  timestamp,
  body,
  signature,
  now = Date.now(),
) {
  if (
    !/^\d+$/.test(timestamp ?? '') ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    !/^[a-f0-9]{64}$/.test(signature ?? '')
  )
    return false;
  return timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(webhookSignature(secret, timestamp, body), 'hex'),
  );
}
