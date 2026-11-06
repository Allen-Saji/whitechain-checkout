'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errorMessage, money, orderLabel } from '@/lib/api';
import type { Workspace } from '@/lib/types';
import { ErrorNotice } from './ui';
export function Shop() {
  const router = useRouter();
  const creatingId = useRef<string | null>(null);
  const [product, setProduct] = useState<{ amount: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<{
    id: string;
    external_id: string;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ amount: string }>('/shop-api/product')
      .then((p) => {
        if (alive) setProduct(p);
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });
    api<Workspace>('/v1/demo')
      .then((d) => {
        if (alive)
          setRecorded(
            d.orders.find((o) =>
              ['paid', 'partially_refunded', 'refunded'].includes(o.state),
            ) ?? null,
          );
      })
      .catch(() => {});
    try {
      setLast(sessionStorage.getItem('checkout:last'));
    } catch {
      /* Storage is optional. */
    }
    return () => {
      alive = false;
    };
  }, []);
  async function buy() {
    setBusy(true);
    setError(null);
    try {
      let id = creatingId.current;
      try {
        id ??= sessionStorage.getItem('checkout:creating');
      } catch {
        /* Use a new in-memory identity when storage is blocked. */
      }
      id ??= crypto.randomUUID();
      creatingId.current = id;
      try {
        sessionStorage.setItem('checkout:creating', id);
      } catch {
        /* Checkout remains usable without storage. */
      }
      const order = await api<{ id: string }>('/shop-api/book', {
        orderId: id,
      });
      try {
        sessionStorage.setItem('checkout:last', order.id);
        sessionStorage.removeItem('checkout:creating');
      } catch {
        /* Receipt URL remains authoritative. */
      }
      router.push('/checkout/' + encodeURIComponent(order.id));
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <>
      <ErrorNotice message={error} />
      <div className="app-kicker">CHECKOUT EXAMPLE</div>
      <div className="shop-grid">
        <section className="shop-description">
          <p className="shop-category">A workshop for builders</p>
          <h1>
            Build with
            <br />
            <em>stablecoins.</em>
          </h1>
          <p className="app-lede">
            Try a USDT purchase from start to finish. Follow the payment, see
            the order arrive, and explore the merchant&apos;s side.
          </p>
          <div className="workshop-art" aria-hidden="true">
            <span className="workshop-art-number">01</span>
            <div className="art-loop" />
            <span>BUILD / PAY / CONNECT</span>
          </div>
        </section>
        <aside className="purchase-card">
          <p className="app-kicker">WORKSHOP CHECKOUT</p>
          <h2>
            One order.
            <br />
            Every step connected.
          </h2>
          <p className="purchase-price">
            {product ? money(product.amount) : '...'} <span>USDT</span>
          </p>
          <dl className="simple-facts">
            <div>
              <dt>Network</dt>
              <dd>Whitechain Sepolia</dd>
            </div>
            <div>
              <dt>Your gas fee</dt>
              <dd>Covered by the relayer</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>Booking receipt</dd>
            </div>
          </dl>
          <button
            className="button button-primary full-width"
            disabled={!product || busy}
            onClick={buy}
          >
            {busy ? 'Creating your checkout...' : 'Continue to checkout'}{' '}
            &#8594;
          </button>
          <p className="fine-print">
            Example workshop checkout on Whitechain Sepolia. No event admission
            is included.
          </p>
          {last ? (
            <Link
              className="text-link"
              href={'/checkout/' + encodeURIComponent(last)}
            >
              Return to your last order &#8599;
            </Link>
          ) : null}
        </aside>
      </div>
      <div className="shop-after">
        <span>Want to see the other side?</span>
        <Link className="text-link" href="/merchant">
          Explore the merchant workspace &#8599;
        </Link>
      </div>
      {recorded ? (
        <div className="recorded-receipt">
          <p className="app-kicker">PAYMENT HISTORY</p>
          <p>Explore a completed payment and its recorded refund.</p>
          <Link className="text-link" href={'/checkout/' + recorded.id}>
            View receipt {orderLabel(recorded.external_id)} &#8599;
          </Link>
        </div>
      ) : null}
    </>
  );
}
