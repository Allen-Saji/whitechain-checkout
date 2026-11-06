'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  api,
  errorMessage,
  explainCode,
  errorStatus,
  money,
  orderLabel,
  shortAddress,
} from '@/lib/api';
import type { Config, Delivery, Order, Session, Workspace } from '@/lib/types';
import { LoadingState } from './loading-state';
import { ErrorNotice } from './ui';
import { RefundDialog } from './refund-dialog';
const labels: Record<string, string> = {
  created: 'Awaiting payment',
  queued: 'Processing',
  paid: 'Paid',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
  failed: 'Needs attention',
  pending: 'Pending',
  delivered: 'Delivered',
  fulfilled: 'Fulfilled',
  unavailable: 'Unavailable',
};
const label = (s: string) => labels[s] ?? s;
const confirmedStates = new Set(['paid', 'partially_refunded', 'refunded']);
export function MerchantWorkspace({
  preview,
  showExample,
}: {
  preview: boolean;
  showExample: boolean;
}) {
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all');
  const [data, setData] = useState<Workspace | null>(null),
    [config, setConfig] = useState<Config | null>(null),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [retrying, setRetrying] = useState<string | null>(null),
    [active, setActive] = useState<string | null>(null),
    [refund, setRefund] = useState<Order | null>(null);
  const load = useCallback(async () => {
    let session: Session | null = null;
    try {
      session = await api<Session>('/v1/session');
    } catch (e) {
      if (errorStatus(e) !== 401) throw e;
    }
    if (session) {
      const [orders, deliveries] = await Promise.all([
        api<{ orders: Order[] }>('/v1/merchant/orders'),
        api<{ deliveries: Delivery[] }>('/v1/merchant/deliveries'),
      ]);
      return {
        ...orders,
        ...deliveries,
        merchant: session.merchant,
        readOnly: false,
      };
    }
    return preview ? api<Workspace>('/v1/demo') : null;
  }, [preview]);
  useEffect(() => {
    let alive = true;
    let refreshing = false;
    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const [next, c] = await Promise.all([
          load(),
          api<Config>('/v1/config'),
        ]);
        if (alive) {
          setError(null);
          setData(next);
          setConfig(c);
          setLoading(false);
        }
      } catch (e) {
        if (alive) {
          setError(errorMessage(e));
          setLoading(false);
        }
      } finally {
        refreshing = false;
      }
    }
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden && !busy && !refund) void refresh();
    }, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [load, busy, refund]);
  async function authenticate() {
    setError(null);
    setBusy(true);
    try {
      if (data && !data.readOnly) await api('/v1/session/logout', {});
      else await (await import('@/lib/wallet')).signIn();
      setData(await load());
      setActive(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function retry(id: string) {
    setError(null);
    setRetrying(id);
    try {
      await api(
        '/v1/merchant/deliveries/' + encodeURIComponent(id) + '/retry',
        {},
      );
      setData(await load());
      setNotice('Notification queued for delivery.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRetrying(null);
    }
  }
  async function retryPayment(id: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api(
        '/v1/merchant/orders/' + encodeURIComponent(id) + '/retry-payment',
        {},
      );
      setData(await load());
      setNotice(
        'The original payment is queued again. No new authorization was created.',
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <>
        <ErrorNotice message={error} />
        <LoadingState label="Loading your workspace" />
      </>
    );
  if (!data)
    return (
      <>
        <ErrorNotice message={error} />
        <section className="access-grid">
          <div>
            <p className="app-kicker">YOUR MERCHANT WORKSPACE</p>
            <h1>
              Payments in.
              <br />
              <em>Everything in view.</em>
            </h1>
            <p className="app-lede">
              Track paid orders, resolve delivery issues, and return funds from
              one workspace.
            </p>
            <ol className="access-features">
              <li>
                <span>01</span> Know when a payment settles.
              </li>
              <li>
                <span>02</span> Recover orders after an outage.
              </li>
              <li>
                <span>03</span> Keep a record of every refund.
              </li>
            </ol>
          </div>
          <aside className="purchase-card access-card">
            <p className="app-kicker">WELCOME BACK</p>
            <h2>
              Your wallet.
              <br />
              Your workspace.
            </h2>
            <p>
              Sign in with your registered payout wallet to access your
              business.
            </p>
            <button
              className="button button-primary full-width"
              disabled={busy}
              onClick={authenticate}
            >
              {busy ? 'Check your wallet...' : 'Connect wallet'} &#8599;
            </button>
            <p className="fine-print">
              Sign a message to log in. No transaction or network fee is
              required.
            </p>
            <div className="access-divider" />
            <h3>Connecting a new business?</h3>
            <p>Set up your payout wallet and payment notifications.</p>
            <Link className="button button-outline full-width" href="/register">
              Create account &#8594;
            </Link>
            {showExample ? (
              <Link
                className="text-link access-preview"
                href="/merchant?view=example"
              >
                Explore a workspace preview &#8599;
              </Link>
            ) : null}
          </aside>
        </section>
      </>
    );
  const confirmed = data.orders.filter((o) => confirmedStates.has(o.state)),
    total = confirmed.reduce((sum, o) => sum + BigInt(o.amount), 0n),
    refunded = confirmed.reduce((sum, o) => sum + BigInt(o.refunded), 0n);
  const visibleOrders = data.orders.filter(
    (o) =>
      (filter === 'all' || o.state === filter) &&
      [o.title, o.external_id, o.buyer].some((v) =>
        v?.toLowerCase().includes(query.toLowerCase().trim()),
      ),
  );
  const order = data.orders.find((o) => o.id === active),
    deliveries = data.deliveries.filter((d) => d.checkout_id === active);
  return (
    <>
      <ErrorNotice message={error} />
      {notice ? (
        <p role="status" className="workspace-mode">
          {notice}
        </p>
      ) : null}
      <div className="workspace-title">
        <div>
          <p className="app-kicker">MERCHANT WORKSPACE</p>
          <h1>
            Orders, <em>accounted for.</em>
          </h1>
          <p className="app-lede">
            See what&apos;s paid, what&apos;s delivered, and what needs your
            attention.
          </p>
        </div>
        {!data.readOnly ? (
          <Link className="text-link" href="/merchant/settings">
            Integration settings &#8599;
          </Link>
        ) : null}
        <button
          className="button button-outline"
          disabled={busy}
          onClick={authenticate}
        >
          {busy
            ? 'Please wait...'
            : data.readOnly
              ? 'Connect merchant wallet'
              : 'Sign out'}
        </button>
      </div>
      <div className="workspace-mode">
        <span className={'status-pill ' + (!data.readOnly ? 'success' : '')}>
          {data.readOnly ? 'Workspace preview' : 'Signed in'}
        </span>
        <p>
          {data.readOnly
            ? 'Example account activity. Sign in to see your own orders and manage payments.'
            : 'Merchant wallet ' +
              shortAddress(data.merchant.payout) +
              '. Your payments and fulfillment in one place.'}
        </p>
      </div>
      <div className="workspace-stats">
        <div>
          <span>Received in recent orders</span>
          <strong>
            {money(total)} <small>USDT</small>
          </strong>
        </div>
        <div>
          <span>Refunded</span>
          <strong>
            {money(refunded)} <small>USDT</small>
          </strong>
        </div>
        <div>
          <span>Awaiting fulfillment</span>
          <strong>
            {confirmed.filter((o) => o.fulfillment !== 'fulfilled').length}
          </strong>
        </div>
      </div>
      <div className="orders-heading">
        <h2>Recent orders</h2>
        <span>Updates every 10 seconds</span>
      </div>
      <div className="order-filters">
        <div>
          <label htmlFor="order-search">Find an order</label>
          <input
            id="order-search"
            type="search"
            placeholder="Title, order ID or buyer wallet"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="order-status">Payment status</label>
          <select
            id="order-status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            {[
              'created',
              'queued',
              'paid',
              'partially_refunded',
              'refunded',
              'failed',
            ].map((s) => (
              <option value={s} key={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="orders-table">
        {visibleOrders.length ? (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Fulfillment</th>
                <th>
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.title ?? orderLabel(o.external_id)}</strong>
                    <small>
                      {new Date(o.created_at).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </small>
                  </td>
                  <td>{money(o.amount)} USDT</td>
                  <td>
                    <span
                      className={
                        'status-pill ' +
                        (confirmedStates.has(o.state) ? 'success' : '')
                      }
                    >
                      {label(o.state)}
                    </span>
                  </td>
                  <td>{label(o.fulfillment)}</td>
                  <td>
                    <button
                      className="table-action"
                      onClick={() => setActive(o.id)}
                    >
                      Details &#8599;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <h3>
              {data.orders.length
                ? 'No matching orders.'
                : 'Your first order starts here.'}
            </h3>
            <p>
              {data.orders.length
                ? 'Try another search or choose a different status.'
                : 'Connect your server and create a checkout to receive your first order.'}
            </p>
            <Link className="text-link" href="/merchant/settings">
              Connect your integration &#8599;
            </Link>
          </div>
        )}
      </div>
      {order ? (
        <section className="workspace-detail">
          <div className="detail-header">
            <div>
              <p className="app-kicker">ORDER DETAILS</p>
              <h2>{orderLabel(order.external_id)}</h2>
            </div>
            <Link className="text-link" href={'/checkout/' + order.id}>
              Open receipt &#8599;
            </Link>
          </div>
          <dl className="simple-facts detail-facts">
            <div>
              <dt>Buyer</dt>
              <dd>{order.buyer ?? 'Not paid yet'}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{label(order.state)}</dd>
            </div>
            <div>
              <dt>Fulfillment</dt>
              <dd>{label(order.fulfillment)}</dd>
            </div>
            <div>
              <dt>Refunded</dt>
              <dd>{money(order.refunded)} USDT</dd>
            </div>
          </dl>
          {order.state === 'failed' ? (
            <div className="recovery-panel" role="status">
              <h3>Payment needs attention</h3>
              <p>{explainCode(order.recovery?.reason ?? order.paymentError)}</p>
              <p className="fine-print">
                A retry reuses the original authorization. Funds are never sent
                twice for this order.
              </p>
              {order.recovery?.retryable ? (
                <button
                  className="button button-outline"
                  disabled={busy || data.readOnly || !config?.relayEnabled}
                  onClick={() => retryPayment(order.id)}
                >
                  {busy ? 'Queuing...' : 'Retry original payment'}
                </button>
              ) : (
                <p>
                  Ask the customer to start a new order if this authorization
                  expired. Transactions already signed or broadcast require
                  operator review.
                </p>
              )}
            </div>
          ) : null}
          <div className="delivery-heading">
            <h3>Merchant notifications</h3>
            <span>Delivery and fulfillment are tracked separately.</span>
          </div>
          <div className="delivery-list">
            {deliveries.length ? (
              deliveries.map((d) => (
                <div className="delivery-item" key={d.id}>
                  <div>
                    <strong>{label(d.status)}</strong>
                    <p>
                      {d.attempts} attempt{d.attempts === 1 ? '' : 's'}
                      {d.last_http ? ' / HTTP ' + d.last_http : ''}
                    </p>
                  </div>
                  <button
                    className="button button-outline"
                    disabled={data.readOnly || retrying !== null}
                    onClick={() => retry(d.id)}
                  >
                    {retrying === d.id ? 'Retrying...' : 'Retry delivery'}
                  </button>
                </div>
              ))
            ) : (
              <p className="muted">
                Notifications appear after payment confirmation.
              </p>
            )}
          </div>
          {!config?.relayEnabled && !data.readOnly ? (
            <p className="workspace-mode">
              Payment processing is paused. Receipts and order history remain
              available.
            </p>
          ) : null}
          <div className="refund-action">
            <div>
              <h3>Refund this order</h3>
              <p>
                Up to {money(BigInt(order.amount) - BigInt(order.refunded))}{' '}
                USDT remains refundable. Your merchant wallet must sign.
              </p>
            </div>
            <button
              className="button button-primary"
              disabled={
                data.readOnly ||
                !config?.relayEnabled ||
                BigInt(order.amount) <= BigInt(order.refunded) ||
                !['paid', 'partially_refunded'].includes(order.state)
              }
              onClick={() => setRefund(order)}
            >
              Issue a refund
            </button>
          </div>
          {data.readOnly ? (
            <p className="fine-print">
              Sign in with the registered merchant wallet to use these controls.
            </p>
          ) : null}
        </section>
      ) : null}
      {refund && config ? (
        <RefundDialog
          order={refund}
          merchant={data.merchant}
          config={config}
          onClose={() => setRefund(null)}
          onSubmitted={async () => {
            try {
              setData(await load());
            } catch {
              setError(
                'Refund submitted. Refresh the workspace to check confirmation; do not submit it again.',
              );
            }
            setNotice(
              'Refund submitted. The receipt will update after confirmation.',
            );
          }}
        />
      ) : null}
    </>
  );
}
