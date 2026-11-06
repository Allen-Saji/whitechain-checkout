import { sessionMerchant } from './sessions.mjs';
import { hash } from '../crypto.mjs';
import { requireThat } from './validation.mjs';
export function createApiContext(db, config = {}) {
  const merchant = (req) => {
    const key = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    const row =
      key &&
      db.prepare('SELECT * FROM merchants WHERE api_hash=?').get(hash(key));
    const authenticated =
      row ?? (!key ? sessionMerchant(req, config, db) : null);
    requireThat(authenticated, 401, 'SIGN_IN_REQUIRED');
    return authenticated;
  };
  const checkout = (id) => {
    const row = db
      .prepare(
        'SELECT c.*,m.payout FROM checkouts c JOIN merchants m ON m.id=c.merchant_id WHERE c.id=?',
      )
      .get(id);
    requireThat(row, 404, 'NOT_FOUND');
    return row;
  };
  const available = () =>
    requireThat(
      !db.prepare('SELECT halted FROM checkpoints WHERE id=1').get()?.halted,
      503,
      'CHAIN_REVIEW_REQUIRED',
    );
  return { merchant, checkout, available };
}
