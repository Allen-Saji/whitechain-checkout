'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Address } from 'viem';
import {
  api,
  errorMessage,
  explainCode,
  money,
  orderLabel,
  shortAddress,
  transactionLink,
} from '@/lib/api';
import type { Authorization, Config, Receipt } from '@/lib/types';
import { connectWallet, signAuthorization, tokenBalance } from '@/lib/wallet';
import { ErrorNotice, PrintButton } from './ui';
const paidStates = new Set(['paid', 'partially_refunded', 'refunded']);
export function Checkout({ id }: { id: string }) {
  const [config, setConfig] = useState<Config | null>(null),
    [order, setOrder] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState<{
    address: Address;
    balance: string;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const [c, o] = await Promise.all([
          api<Config>('/v1/config'),
          api<Receipt>('/v1/checkouts/' + encodeURIComponent(id)),
        ]);
        if (alive) {
          setConfig(c);
          setOrder(o);
        }
      } catch (e) {
        if (alive) setError(errorMessage(e));
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden && !busy) void refresh();
    }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id, busy]);
  async function connect() {
    if (!config) return;
    setConnecting(true);
    setError(null);
    try {
      const w = await connectWallet();
      setConnected({
        address: w.address,
        balance: money(await tokenBalance(w.address, config.token)),
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setConnecting(false);
    }
  }
  async function pay() {
    if (!order || !config || !connected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const w = await connectWallet();
      if (w.address.toLowerCase() !== connected.address.toLowerCase())
        throw Error(
          'The selected account changed. Connect it again to review its balance.',
        );
      if ((await tokenBalance(w.address, config.token)) < BigInt(order.amount))
        throw Error(
          'This wallet does not have enough USDT. Add funds, then try again.',
        );
      const auth = await api<Authorization>(
        `/v1/checkouts/${encodeURIComponent(id)}/authorization`,
        { payer: w.address },
      );
      const signature = await signAuthorization(auth, {
        from: w.address,
        token: config.token,
        router: config.router,
        amount: order.amount,
      });
      await api(`/v1/checkouts/${encodeURIComponent(id)}/pay`, {
        payer: w.address,
        signature,
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      try {
        setOrder(await api<Receipt>('/v1/checkouts/' + encodeURIComponent(id)));
      } catch {
        /* Preserve the last receipt; never submit twice after a read failure. */
      }
      setBusy(false);
    }
  }
  if (!order || !config)
    return (
      <>
        <ErrorNotice message={error} />
        <p className="loading-label" role="status">
          Loading your order...
        </p>
      </>
    );
  const paid = paidStates.has(order.state),
    queued = order.state === 'queued',
    expired = order.expiresAt <= Date.now() / 1000 && !paid && !queued;
  return (
    <>
      <ErrorNotice message={error} />
      <Link className="back-link" href="/shop">
        &#8592; Back to shop
      </Link>
      <div className="checkout-heading">
        <p className="app-kicker">WORKSHOP BOOKING</p>
        <h1>
          {paid ? (
            <>
              Payment <em>received.</em>
            </>
          ) : queued ? (
            <>
              Payment <em>in progress.</em>
            </>
          ) : (
            <>
              Review your <em>order.</em>
            </>
          )}
        </h1>
        <p className="app-lede">
          {paid
            ? order.fulfillment === 'fulfilled'
              ? 'Your order is complete. Your receipt is below.'
              : 'Your payment is confirmed. We are waiting for the merchant to finish your order.'
            : queued
              ? 'Your signed payment is being processed. You can return to this page at any time.'
              : "Pay in USDT. We'll cover the network fee."}
        </p>
      </div>
      <div className="checkout-grid">
        <section className="checkout-summary">
          <div className="summary-top">
            <span className="order-monogram">W</span>
            <div>
              <h2>Build with stablecoins</h2>
              <p>Workshop order</p>
            </div>
          </div>
          <dl className="simple-facts">
            <div>
              <dt>Order</dt>
              <dd>{orderLabel(order.orderId)}</dd>
            </div>
            <div>
              <dt>Merchant wallet</dt>
              <dd title={order.merchant}>{shortAddress(order.merchant)}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>{money(order.amount)} USDT</dd>
            </div>
            <div>
              <dt>Customer gas fee</dt>
              <dd>Covered by relayer</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Whitechain Sepolia</dd>
            </div>
          </dl>
          <div className="receipt-status" aria-live="polite">
            <div>
              <span>Payment</span>
              <strong className={'status-pill ' + (paid ? 'success' : '')}>
                {paid
                  ? 'Confirmed'
                  : queued
                    ? 'Processing'
                    : order.state === 'failed'
                      ? 'Needs attention'
                      : expired
                        ? 'Expired'
                        : 'Not paid'}
              </strong>
            </div>
            <div>
              <span>Fulfillment</span>
              <strong>
                {order.fulfillment === 'fulfilled'
                  ? 'Order complete'
                  : order.fulfillment === 'unavailable'
                    ? 'Merchant unavailable'
                    : paid
                      ? 'Waiting for merchant'
                      : 'Not started'}
              </strong>
            </div>
            {BigInt(order.refunded) > 0n ? (
              <div>
                <span>Refunded</span>
                <strong>{money(order.refunded)} USDT</strong>
              </div>
            ) : null}
          </div>
          <div className="receipt-timeline">
            {order.timeline.map((event) => (
              <a
                key={event.transactionHash}
                href={transactionLink(event.transactionHash) ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>
                  {event.type === 'Paid'
                    ? 'Payment confirmed'
                    : 'Refund confirmed'}
                  <small>Block {event.blockNumber}</small>
                </span>
                <span>View transaction &#8599;</span>
              </a>
            ))}
          </div>
        </section>
        <aside className="payment-card">
          {paid ? (
            <>
              <span className="receipt-success-mark" aria-hidden="true">
                &#10003;
              </span>
              <p className="app-kicker">PAYMENT RECEIPT</p>
              <h2>
                {money(order.amount)} <em>USDT</em>
              </h2>
              <p className="card-description">
                {order.fulfillment === 'fulfilled'
                  ? 'The merchant has completed your order.'
                  : 'The payment is recorded. Delivery will be retried if the merchant is temporarily offline.'}
              </p>
              <PrintButton className="button button-outline full-width">
                Print receipt
              </PrintButton>
            </>
          ) : queued ? (
            <>
              <div className="processing-dot" aria-hidden="true" />
              <h2>
                Checking the
                <br />
                <em>payment.</em>
              </h2>
              <p className="card-description">
                No need to sign again. This page will update when the
                transaction is confirmed.
              </p>
            </>
          ) : expired || order.state === 'failed' ? (
            <>
              <p className="app-kicker">
                {expired ? 'CHECKOUT EXPIRED' : 'PAYMENT NEEDS ATTENTION'}
              </p>
              <h2>
                Let&apos;s check
                <br />
                <em>what happened.</em>
              </h2>
              <p className="card-description">
                {expired
                  ? 'The payment window ended. Start a new order to continue.'
                  : explainCode(order.paymentJob?.error)}
              </p>
              <Link className="button button-outline full-width" href="/shop">
                Return to shop
              </Link>
            </>
          ) : (
            <>
              <p className="app-kicker">TOTAL TO PAY</p>
              <h2>
                {money(order.amount)} <em>USDT</em>
              </h2>
              <button
                className="wallet-connect"
                disabled={connecting || busy}
                onClick={connect}
              >
                {connecting
                  ? 'Connecting...'
                  : connected
                    ? shortAddress(connected.address) + ' - reconnect'
                    : 'Connect your wallet'}{' '}
                &#8599;
              </button>
              <p className="wallet-balance">
                {!config.relayEnabled
                  ? 'Payments are temporarily paused. Your order remains available.'
                  : connected
                    ? connected.balance + ' USDT available'
                    : 'Connect a wallet with USDT on Whitechain Sepolia.'}
              </p>
              <button
                className="button button-primary full-width"
                disabled={!connected || busy || !config.relayEnabled}
                onClick={pay}
              >
                {busy
                  ? 'Check your wallet...'
                  : 'Pay ' + money(order.amount) + ' USDT'}
              </button>
              <p className="fine-print">
                You&apos;ll sign one payment authorization. This does not grant
                an unlimited token allowance.
              </p>
            </>
          )}
          <div className="payment-boundary">
            <p>Your USDT goes directly to the merchant.</p>
            <p>
              Refunds require the merchant&apos;s approval and available funds.
            </p>
          </div>
          <Link className="text-link" href="/merchant">
            Merchant workspace &#8599;
          </Link>
        </aside>
      </div>
    </>
  );
}
