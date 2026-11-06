import test from 'node:test';
import assert from 'node:assert/strict';
import { relayScopeAllows } from '../src/relay-scope.mjs';
test('scoped relay accepts only the approved checkout and bounded amounts', () => {
  const config = {
    relayCheckoutId: 'approved',
    relayMaxPaymentAmount: '100000',
    relayMaxRefundAmount: '50000',
  };
  assert(
    relayScopeAllows(config, {
      checkoutId: 'approved',
      kind: 'pay',
      amount: '100000',
    }),
  );
  assert(
    relayScopeAllows(config, {
      checkoutId: 'approved',
      kind: 'refund',
      amount: '50000',
    }),
  );
  assert(
    !relayScopeAllows(config, {
      checkoutId: 'other',
      kind: 'pay',
      amount: '1',
    }),
  );
  assert(
    !relayScopeAllows(config, {
      checkoutId: 'approved',
      kind: 'pay',
      amount: '100001',
    }),
  );
  assert(
    !relayScopeAllows(config, {
      checkoutId: 'approved',
      kind: 'refund',
      amount: '50001',
    }),
  );
  assert(
    relayScopeAllows(
      {},
      { checkoutId: 'normal', kind: 'pay', amount: '2000000' },
    ),
  );
});
