/** Optional operator boundary for a single approved checkout/rehearsal. */
export function relayScopeAllows(config, { checkoutId, kind, amount }) {
  if (config.relayCheckoutId && checkoutId !== config.relayCheckoutId)
    return false;
  const limit =
    kind === 'refund'
      ? config.relayMaxRefundAmount
      : config.relayMaxPaymentAmount;
  return !limit || BigInt(amount) <= BigInt(limit);
}
