import Image from 'next/image';
import sculpture from '../public/continuity-sculpture.png';
import { siteUrl, siteDescription } from '@/lib/site';
export const metadata = { alternates: { canonical: siteUrl } };
import { LandingInteractions } from '@/components/landing-interactions';
export default function Landing() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Checkout',
            url: siteUrl,
            description: siteDescription,
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            featureList: [
              'USDT payment authorization',
              'Sponsored transaction gas',
              'Signed webhook delivery',
              'Merchant-authorized refunds',
            ],
            isAccessibleForFree: true,
          }).replace(/</g, '\u003c'),
        }}
      />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header wrap">
        <a className="wordmark" href="#top" aria-label="Checkout home">
          <img src="/mark.svg" alt="" width="34" height="34" />
          checkout.
        </a>
        <nav aria-label="Main navigation">
          <a href="#product">Product</a>
          <a href="#developers">Developers</a>
          <a href="#questions">Questions</a>
        </nav>
        <a className="button button-outline nav-action" href="/merchant">
          Open workspace <span aria-hidden="true">&#8599;</span>
        </a>
        <button
          className="menu-toggle"
          aria-label="Open navigation"
          aria-expanded="false"
          aria-controls="mobile-nav"
        >
          <span></span>
          <span></span>
        </button>
      </header>
      <nav
        id="mobile-nav"
        className="mobile-nav"
        aria-label="Mobile navigation"
        hidden
      >
        <a href="#product">Product</a>
        <a href="#developers">Developers</a>
        <a href="#questions">Questions</a>
        <a href="/merchant">Open workspace</a>
      </nav>
      <main id="main">
        <section className="hero" id="top" aria-labelledby="hero-heading">
          <div className="hero-copy wrap">
            <p className="eyebrow">
              <span className="status-dot"></span> USDT PAYMENTS FOR YOUR
              BUSINESS
            </p>
            <h1 id="hero-heading">
              Accept USDT.
              <br />
              Keep orders <em>in view.</em>
            </h1>
            <p className="hero-lede">
              Add USDT checkout to your app. Cover customer gas,
              <br className="desktop-break" />
              track paid orders, and retry notifications after an outage.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="/merchant">
                Open workspace <span aria-hidden="true">&#8599;</span>
              </a>
              <a className="text-link" href="#product">
                How it works <span aria-hidden="true">&#8595;</span>
              </a>
            </div>
          </div>
          <div
            className="hero-scene"
            aria-label="Illustrative payment receipt connected to an order"
          >
            <Image
              className="sculpture"
              src={sculpture}
              sizes="100vw"
              loading="eager"
              alt=""
              width="2172"
              height="724"
              fetchPriority="high"
            />
            <div className="hero-receipt">
              <div className="receipt-top">
                <img src="/mark.svg" width="26" height="26" alt="" />
                <span>Workshop booking</span>
                <span className="receipt-reference">001</span>
              </div>
              <p className="receipt-amount">
                2 <span>USDT</span>
              </p>
              <div className="receipt-rule"></div>
              <p className="receipt-row">
                <span className="check" aria-hidden="true">
                  &#10003;
                </span>{' '}
                Payment received
              </p>
              <p className="receipt-row">
                <span className="check" aria-hidden="true">
                  &#10003;
                </span>{' '}
                Order fulfilled
              </p>
              <p className="receipt-caption">Payment receipt</p>
            </div>
          </div>
          <div className="hero-bottom wrap">
            <span>PAYMENT RECEIPTS. ORDER RECOVERY. REFUNDS.</span>
            <span>
              <i className="status-dot"></i> Direct wallet settlement
            </span>
          </div>
        </section>
        <section className="intro section wrap" id="product">
          <div className="section-heading reveal">
            <p className="eyebrow">01 / PAYMENT AND ORDER, TOGETHER</p>
            <h2>
              An outage shouldn't
              <br />
              lose <em>the order.</em>
            </h2>
          </div>
          <div className="intro-copy reveal">
            <p>
              A customer pays. Your server goes offline. The payment is real,
              but the order is missing.
            </p>
            <p>
              We record the payment and retry delivery when your app returns.
              Your integration fulfills the order once, without charging the
              customer again.
            </p>
            <a className="text-link" href="#walkthrough">
              Follow a payment <span aria-hidden="true">&#8600;</span>
            </a>
          </div>
        </section>
        <section
          className="walkthrough-section"
          id="walkthrough"
          aria-labelledby="flow-title"
        >
          <div className="wrap walkthrough-grid">
            <div className="flow-description reveal">
              <p className="eyebrow">02 / FOLLOW ONE ORDER</p>
              <h2 id="flow-title">
                See what happens
                <br />
                <em>after payment.</em>
              </h2>
              <p className="section-lede">
                The customer sees a payment.
                <br />
                You see what happens next.
              </p>
              <div
                className="steps"
                role="tablist"
                aria-label="Payment recovery walkthrough"
                aria-orientation="vertical"
              >
                <button
                  id="step-paid"
                  role="tab"
                  aria-selected="true"
                  aria-controls="flow-panel"
                  data-step="0"
                >
                  <span className="step-number">01</span>
                  <span>
                    <strong>Accept the payment.</strong>
                    <small>
                      The customer pays in USDT. The relayer covers gas.
                    </small>
                  </span>
                  <span className="step-arrow" aria-hidden="true">
                    &#8599;
                  </span>
                </button>
                <button
                  id="step-offline"
                  role="tab"
                  aria-selected="false"
                  aria-controls="flow-panel"
                  tabIndex={-1}
                  data-step="1"
                >
                  <span className="step-number">02</span>
                  <span>
                    <strong>Keep the record.</strong>
                    <small>
                      Your app is offline. The paid order stays in the queue.
                    </small>
                  </span>
                  <span className="step-arrow" aria-hidden="true">
                    &#8599;
                  </span>
                </button>
                <button
                  id="step-recovered"
                  role="tab"
                  aria-selected="false"
                  aria-controls="flow-panel"
                  tabIndex={-1}
                  data-step="2"
                >
                  <span className="step-number">03</span>
                  <span>
                    <strong>Finish the handoff.</strong>
                    <small>Your app recovers. One order is fulfilled.</small>
                  </span>
                  <span className="step-arrow" aria-hidden="true">
                    &#8599;
                  </span>
                </button>
              </div>
            </div>
            <div className="flow-stage reveal">
              <div className="stage-orbit" aria-hidden="true"></div>
              <div
                id="flow-panel"
                className="order-panel"
                role="tabpanel"
                aria-labelledby="step-paid"
                tabIndex={0}
              >
                <div className="order-panel-top">
                  <span className="order-monogram">W</span>
                  <div>
                    <strong>Workshop booking</strong>
                    <span>Order 001</span>
                  </div>
                  <span className="network-chip">USDT</span>
                </div>
                <p className="order-amount">
                  2.00 <span>USDT</span>
                </p>
                <div className="order-divider"></div>
                <dl className="order-facts">
                  <div>
                    <dt>Payment</dt>
                    <dd>
                      <span className="tiny-check" aria-hidden="true">
                        &#10003;
                      </span>
                      Confirmed
                    </dd>
                  </div>
                  <div>
                    <dt>Customer gas</dt>
                    <dd>Covered by relayer</dd>
                  </div>
                  <div>
                    <dt>Fulfillment</dt>
                    <dd id="fulfillment-state">Waiting for merchant</dd>
                  </div>
                </dl>
                <div className="event-log" aria-live="polite">
                  <span className="event-marker" aria-hidden="true"></span>
                  <div>
                    <strong id="event-title">Payment received.</strong>
                    <p id="event-detail">
                      A confirmed receipt is recorded before your merchant app
                      is notified.
                    </p>
                  </div>
                </div>
                <div className="order-panel-bottom">
                  <span id="event-counter">01 / PAYMENT CONFIRMED</span>
                  <span className="live-indicator" aria-hidden="true"></span>
                </div>
              </div>
              <p className="demo-caption">Payment lifecycle</p>
              <button id="advance-demo" className="text-link">
                Simulate an outage <span aria-hidden="true">&#8594;</span>
              </button>
            </div>
          </div>
        </section>
        <section className="details-section section wrap">
          <div className="section-heading reveal">
            <p className="eyebrow">03 / WHAT YOUR CHECKOUT INCLUDES</p>
            <h2>
              Gas, receipts,
              <br />
              and <em>refunds.</em>
            </h2>
            <p className="section-lede">
              From the first payment to what comes after.
            </p>
          </div>
          <div className="detail-list reveal">
            <article>
              <span>01</span>
              <div>
                <h3>Gas, taken care of.</h3>
                <p>
                  Your customer signs the payment authorization. The relayer
                  submits it and pays the network fee.
                </p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>Retries that respect the order.</h3>
                <p>
                  Signed events and stable order IDs help your integration
                  recover without creating duplicate bookings.
                </p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Refunds with a receipt.</h3>
                <p>
                  Authorize a full or partial refund from your merchant wallet.
                  Both parties can verify the onchain record.
                </p>
              </div>
            </article>
          </div>
        </section>
        <section className="evidence wrap reveal">
          <div>
            <p className="eyebrow">VERIFIABLE SETTLEMENT</p>
            <h3>Every payment has a record.</h3>
            <p>
              A 2 USDT payment. A 0.5 USDT refund.
              <br />
              Zero WBT held by the buyer and merchant.
            </p>
          </div>
          <div className="evidence-links">
            <a
              href="https://explorer.testnet.whitechain.io/tx/0x7803084d3483a045a5c752c39560067a245ef7ec6f929200922dd54439ea17fc"
              target="_blank"
              rel="noopener noreferrer"
            >
              View payment <span aria-hidden="true">&#8599;</span>
            </a>
            <a
              href="https://explorer.testnet.whitechain.io/tx/0x5ac212bf80be6863c040b6a4742783aaef72be952b0fb9042a9cbc5e4057e8cf"
              target="_blank"
              rel="noopener noreferrer"
            >
              View partial refund <span aria-hidden="true">&#8599;</span>
            </a>
          </div>
        </section>
        <section className="integration section wrap" id="developers">
          <div className="reveal">
            <p className="eyebrow">04 / FOR BUILDERS</p>
            <h2>
              Connect your app.
              <br />
              Keep <em>your workflow.</em>
            </h2>
            <p className="section-lede">
              Create a checkout on your server.
              <br />
              Connect your existing fulfillment logic.
            </p>
            <a
              className="text-link"
              href="/docs/quickstart"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the integration guide
              <span aria-hidden="true">&#8599;</span>
            </a>
          </div>
          <div className="code-surface reveal">
            <div className="code-header">
              <span>merchant-server.mjs</span>
              <button
                id="copy-code"
                aria-label="Copy checkout integration example"
              >
                Copy <span aria-hidden="true">&#8599;</span>
              </button>
            </div>
            <pre>
              <code id="integration-code"></code>
            </pre>
            <div className="code-footnote">
              <span className="status-dot"></span> Server-side SDK. Keep API
              keys on your server.
            </div>
          </div>
        </section>
        <section className="faq section wrap" id="questions">
          <div className="reveal">
            <p className="eyebrow">A FEW THINGS TO KNOW</p>
            <h2>
              Clear from
              <br />
              the <em>start.</em>
            </h2>
          </div>
          <div className="faq-list reveal">
            <details>
              <summary>
                Does the customer need WBT?<span aria-hidden="true">+</span>
              </summary>
              <p>
                No. The customer needs USDT and signs a payment authorization.
                Our relayer submits the transaction and pays gas in WBT.
              </p>
            </details>
            <details>
              <summary>
                What happens if my server goes down?
                <span aria-hidden="true">+</span>
              </summary>
              <p>
                Confirmed payments stay recorded. We retry the merchant
                notification when your endpoint is available. Your integration
                must fulfill idempotently and acknowledge completion.
              </p>
            </details>
            <details>
              <summary>
                Who holds the payment?<span aria-hidden="true">+</span>
              </summary>
              <p>
                The checkout contract forwards the payment directly to the
                merchant in the same transaction. It does not retain the payment
                as escrow.
              </p>
            </details>
            <details>
              <summary>
                Are refunds guaranteed?<span aria-hidden="true">+</span>
              </summary>
              <p>
                No. Refunds require the merchant's authorization and enough USDT
                in their wallet. The contract tracks the amount refunded and
                prevents refunding more than was paid.
              </p>
            </details>
            <details>
              <summary>
                How do I connect my business?<span aria-hidden="true">+</span>
              </summary>
              <p>
                Register your payout wallet and notification endpoint, create a
                checkout from your server, and connect your existing fulfillment
                logic. <a href="/start">Read the setup guide.</a>
              </p>
            </details>
          </div>
        </section>
        <section className="closing wrap reveal">
          <p className="eyebrow">BUILT FOR YOUR NEXT INTEGRATION</p>
          <h2>
            Add USDT payments
            <br />
            to <em>your app.</em>
          </h2>
          <a
            className="button button-primary"
            href="https://github.com/Allen-Saji/whitechain-checkout"
            target="_blank"
            rel="noopener noreferrer"
          >
            Build with checkout <span aria-hidden="true">&#8599;</span>
          </a>
          <p>Direct settlement. Recoverable orders. Verifiable refunds.</p>
        </section>
      </main>
      <footer className="site-footer wrap">
        <a className="wordmark" href="#top">
          <img src="/mark.svg" alt="" width="28" height="28" />
          checkout.
        </a>
        <span>Payments, with continuity.</span>
        <a
          href="https://github.com/Allen-Saji/whitechain-checkout"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub <span aria-hidden="true">&#8599;</span>
        </a>
        <span className="footer-network">Built on Whitechain</span>
      </footer>

      <LandingInteractions />
    </>
  );
}
