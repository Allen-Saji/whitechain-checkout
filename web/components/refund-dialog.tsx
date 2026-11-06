'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseUnits } from 'viem';
import type {
  Authorization,
  Config,
  Merchant,
  Order,
  RefundSummary,
} from '@/lib/types';
import { api, errorMessage, money } from '@/lib/api';
import { LoadingState } from './loading-state';
export function RefundDialog({
  order,
  merchant,
  config,
  onClose,
  onSubmitted,
}: {
  order: Order;
  merchant: Merchant;
  config: Config;
  onClose: () => void;
  onSubmitted: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    refundKey = useRef(crypto.randomUUID());
  const reservation = useRef<{ id: string; amount: string } | null>(null);
  const [summary, setSummary] = useState<RefundSummary | null>(null),
    [value, setValue] = useState(''),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [step, setStep] = useState(''),
    [balance, setBalance] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const next = await api<RefundSummary>(
      `/v1/merchant/orders/${order.id}/refunds`,
    );
    setSummary(next);
    return next;
  }, [order.id]);
  useEffect(() => {
    ref.current?.showModal();
    let alive = true;
    api<RefundSummary>(`/v1/merchant/orders/${order.id}/refunds`)
      .then((s) => {
        if (alive) setSummary(s);
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [order.id]);
  async function cancelReservation(id: string) {
    setBusy(true);
    setError(null);
    setStep('Releasing reservation...');
    try {
      await api(`/v1/merchant/refunds/${id}/cancel`, {});
      if (reservation.current?.id === id) {
        reservation.current = null;
        refundKey.current = crypto.randomUUID();
      }
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !summary) return;
    setBusy(true);
    setError(null);
    try {
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value.trim()))
        throw Error('Enter an amount with up to six decimal places.');
      const amount = parseUnits(value.trim(), 6);
      if (amount <= 0n) throw Error('Enter an amount greater than zero.');
      const current = await refresh();
      const available =
        BigInt(current.available) + BigInt(reservation.current?.amount ?? '0');
      if (amount > available)
        throw Error(
          'This amount exceeds the balance available for a new refund.',
        );
      if (
        reservation.current &&
        reservation.current.amount !== amount.toString()
      )
        throw Error(
          'Release your previous reservation before changing the amount.',
        );
      setStep('Connect your merchant wallet...');
      const { connectWallet, tokenBalance, signAuthorization } =
        await import('@/lib/wallet');
      const wallet = await connectWallet();
      if (wallet.address.toLowerCase() !== merchant.payout.toLowerCase())
        throw Error('Switch to your registered merchant payout wallet.');
      const funds = await tokenBalance(wallet.address, config.token);
      setBalance(funds.toString());
      if (funds < amount)
        throw Error(
          'Your merchant wallet does not have enough USDT for this refund. Add funds before continuing.',
        );
      const refund = await api<{ id: string; authorization: Authorization }>(
        `/v1/merchant/orders/${order.id}/refunds`,
        { refundId: refundKey.current, amount: amount.toString() },
      );
      reservation.current = { id: refund.id, amount: amount.toString() };
      await refresh();
      setStep('Review the refund in your wallet...');
      const signature = await signAuthorization(refund.authorization, {
        from: wallet.address,
        token: config.token,
        router: config.router,
        amount: amount.toString(),
      });
      setStep('Submitting your refund...');
      await api(`/v1/merchant/refunds/${refund.id}/submit`, { signature });
      reservation.current = null;
      await onSubmitted();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="refund-dialog"
      aria-labelledby="refund-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={onClose}
    >
      <form onSubmit={submit} aria-busy={busy}>
        {!config.relayEnabled ? (
          <p className="workspace-mode">
            Processing is paused. You can review refunds and release unsubmitted
            reservations.
          </p>
        ) : null}
        <p className="app-kicker">MERCHANT-AUTHORIZED REFUND</p>
        <h2 id="refund-title">
          Review
          <br />
          <em>your refund.</em>
        </h2>
        <p>
          Funds return to the original buyer from your merchant wallet. A
          submitted refund is confirmed on-chain before the receipt changes.
        </p>
        {!summary ? (
          error ? (
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setError(null);
                void refresh().catch((e) => setError(errorMessage(e)));
              }}
            >
              Try loading refunds again
            </button>
          ) : (
            <LoadingState label="Checking refundable balance" compact />
          )
        ) : (
          <>
            <dl className="simple-facts">
              <div>
                <dt>Already refunded</dt>
                <dd>{money(order.refunded)} USDT</dd>
              </div>
              <div>
                <dt>Reserved or processing</dt>
                <dd>{money(summary.reserved)} USDT</dd>
              </div>
              <div>
                <dt>Available for a new refund</dt>
                <dd>{money(summary.available)} USDT</dd>
              </div>
              {balance !== null ? (
                <div>
                  <dt>Wallet balance</dt>
                  <dd>{money(balance)} USDT</dd>
                </div>
              ) : null}
            </dl>
            {summary.refunds
              .filter((r) => ['created', 'queued'].includes(r.status))
              .map((r) => (
                <div className="refund-reservation" key={r.id}>
                  <p>
                    <strong>{money(r.amount)} USDT</strong> -{' '}
                    {r.status === 'queued'
                      ? 'Submitted for processing'
                      : 'Awaiting authorization'}
                  </p>
                  {r.status === 'created' ? (
                    <>
                      <small>
                        Expires{' '}
                        {new Date(r.deadline * 1000).toLocaleTimeString()}.
                        Closing this dialog keeps the reservation.
                      </small>
                      <button
                        type="button"
                        className="text-link"
                        disabled={busy}
                        onClick={() => cancelReservation(r.id)}
                      >
                        Release reservation
                      </button>
                    </>
                  ) : (
                    <small>
                      Already submitted. Check the receipt before taking another
                      action.
                    </small>
                  )}
                </div>
              ))}
            <label htmlFor="refund-amount">Amount in USDT</label>
            <input
              autoFocus
              id="refund-amount"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.05"
              required
              aria-describedby="refund-amount-help"
            />
            <small id="refund-amount-help">
              Up to{' '}
              {money(
                BigInt(summary.available) +
                  BigInt(reservation.current?.amount ?? '0'),
              )}{' '}
              USDT for this request.
            </small>
          </>
        )}
        {error ? (
          <p className="dialog-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="button button-primary full-width"
          disabled={busy || !summary || !config.relayEnabled}
        >
          {busy ? (
            <>
              <span className="loading-spinner" aria-hidden="true" />
              {step}
            </>
          ) : (
            'Review in wallet'
          )}
        </button>
        <button
          type="button"
          className="text-link"
          disabled={busy}
          onClick={onClose}
        >
          Close
        </button>
      </form>
    </dialog>
  );
}
