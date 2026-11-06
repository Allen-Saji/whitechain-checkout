'use client';
import { useEffect, useRef, useState } from 'react';
import { parseUnits } from 'viem';
import type { Authorization, Config, Merchant, Order } from '@/lib/types';
import { api, errorMessage, money } from '@/lib/api';
import { connectWallet, signAuthorization } from '@/lib/wallet';
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
    refundId = useRef(crypto.randomUUID()),
    reserved = useRef<string | null>(null);
  const [value, setValue] = useState(''),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const remaining = BigInt(order.amount) - BigInt(order.refunded);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value.trim()))
        throw Error(
          'Enter a USDT amount with no more than six decimal places.',
        );
      const amount = parseUnits(value.trim(), 6);
      if (amount <= 0n || amount > remaining)
        throw Error(
          'Choose an amount within the remaining refundable balance.',
        );
      const wallet = await connectWallet();
      if (wallet.address.toLowerCase() !== merchant.payout.toLowerCase())
        throw Error(
          'Switch to the merchant payout wallet before signing this refund.',
        );
      if (reserved.current !== null && reserved.current !== amount.toString())
        throw Error(
          'A refund for the previous amount is reserved. Keep that amount or wait for the reservation to expire.',
        );
      const refund = await api<{ id: string; authorization: Authorization }>(
        `/v1/merchant/orders/${order.id}/refunds`,
        { refundId: refundId.current, amount: amount.toString() },
      );
      reserved.current = amount.toString();
      const signature = await signAuthorization(refund.authorization, {
        from: wallet.address,
        token: config.token,
        router: config.router,
        amount: amount.toString(),
      });
      await api(`/v1/merchant/refunds/${refund.id}/submit`, { signature });
      await onSubmitted();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="refund-dialog"
      aria-labelledby="refund-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <p className="app-kicker">MERCHANT-AUTHORIZED REFUND</p>
        <h2 id="refund-title">
          Return a little.
          <br />
          Or <em>all of it.</em>
        </h2>
        <p>
          Funds come from your merchant wallet. The receipt updates after
          confirmation.
        </p>
        <label htmlFor="refund-amount">Amount in USDT</label>
        <input
          id="refund-amount"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.50"
          required
        />
        <small>Maximum {money(remaining)} USDT</small>
        {error ? (
          <p className="dialog-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="button button-primary full-width"
          disabled={busy || !config.relayEnabled}
        >
          {busy ? 'Check your wallet...' : 'Review in wallet'}
        </button>
        <button
          type="button"
          className="text-link"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
      </form>
    </dialog>
  );
}
