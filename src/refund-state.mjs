export function refundSummary(
  db,
  checkout,
  now = Math.floor(Date.now() / 1000),
) {
  const refunds = db
    .prepare(
      'SELECT id,external_id,amount,deadline,status FROM refunds WHERE checkout_id=? ORDER BY rowid DESC',
    )
    .all(checkout.id)
    .map((r) => ({
      ...r,
      status:
        r.status === 'created' && r.deadline <= now ? 'expired' : r.status,
    }));
  const reserved = refunds
    .filter((r) => ['created', 'queued'].includes(r.status))
    .reduce((sum, r) => sum + BigInt(r.amount), 0n);
  return {
    refunds,
    reserved: reserved.toString(),
    available: (
      BigInt(checkout.amount) -
      BigInt(checkout.refunded) -
      reserved
    ).toString(),
  };
}
