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
          Sign in <span aria-hidden="true">&#8599;</span>
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
              <span className="status-dot"></span> CHECKOUT AND PAYMENT
              MANAGEMENT
            </p>
            <h1 id="hero-heading">
              Get paid in USDT.
              <br />
              Stay <em>in control.</em>
            </h1>
            <p className="hero-lede">
              A ready-to-use checkout for your business. Collect payments
              directly to your wallet, and manage orders, receipts and refunds
              from one workspace.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="/register">
                Start accepting payments <span aria-hidden="true">&#8599;</span>
              </a>
              <a className="text-link" href="#product">
                See how it works <span aria-hidden="true">&#8595;</span>
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
            <span>HOSTED CHECKOUT. PAYMENT TRACKING. REFUNDS.</span>
            <span>
              <i className="status-dot"></i> Direct wallet settlement
            </span>
          </div>
        </section>
        <section className="intro section wrap" id="product">
          <div className="section-heading reveal">
            <p className="eyebrow">01 / YOUR PAYMENTS, ORGANIZED</p>
            <h2>
              Know where every
              <br />
              payment <em>stands.</em>
            </h2>
          </div>
          <div className="intro-copy reveal">
            <p>
              A wallet transfer tells you money moved. Running a business also
              means matching that payment to an order, delivering the purchase,
              and handling a refund when plans change.
            </p>
            <p>
              Checkout keeps that work connected. Each payment has an order, a
              receipt and a clear status, so you can see what is paid and what
              still needs your attention.
            </p>
            <a className="text-link" href="#walkthrough">
              Take a closer look <span aria-hidden="true">&#8600;</span>
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
              <p className="eyebrow">02 / KEEP THE ORDER MOVING</p>
              <h2 id="flow-title">
                They pay.
                <br />
                You keep <em>moving.</em>
              </h2>
              <p className="section-lede">
                Your customer gets a simple checkout.
                <br />
                Your app gets a reliable payment record.
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
                    <strong>Give customers a simple checkout.</strong>
                    <small>
                      They pay in USDT. Checkout takes care of the network fee.
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
                    <strong>Keep paid orders accounted for.</strong>
                    <small>
                      If your server goes offline, the confirmed payment stays
                      recorded.
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
                    <strong>Pick up where you left off.</strong>
                    <small>
                      Notifications retry so your app can complete the order
                      once.
                    </small>
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
            <p className="eyebrow">03 / MORE OF THE PAYMENT WORK, HANDLED</p>
            <h2>
              From the first payment
              <br />
              to the <em>final receipt.</em>
            </h2>
            <p className="section-lede">
              The tools to collect, track and manage USDT payments.
            </p>
          </div>
          <div className="detail-list reveal">
            <article>
              <span>01</span>
              <div>
                <h3>Let customers pay with the USDT they have.</h3>
                <p>
                  Share a hosted checkout from your app. Customers connect a
                  wallet and authorize the amount. Checkout covers the network
                  fee, so they do not need a separate gas-token balance.
                </p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>Keep payment records tied to the purchase.</h3>
                <p>
                  See the product, customer wallet, payment and fulfillment
                  status together. Search your orders and open a receipt
                  whenever a customer needs an update.
                </p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Handle returns from the same workspace.</h3>
                <p>
                  Review the amount available, authorize a full or partial
                  refund, and follow it through confirmation. The original
                  receipt keeps the payment and refund together.
                </p>
              </div>
            </article>
          </div>
        </section>
        <section className="evidence wrap reveal">
          <div>
            <p className="eyebrow">VERIFIABLE SETTLEMENT</p>
            <h3>A receipt you can check for yourself.</h3>
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
              A few lines to checkout.
              <br />
              Built for <em>your app.</em>
            </h2>
            <p className="section-lede">
              Set the price on your server, create a checkout, and send your
              customer to the payment link. A signed notification tells your app
              when the payment is confirmed.
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
              A few answers
              <br />
              before you <em>start.</em>
            </h2>
          </div>
          <div className="faq-list reveal">
            <details>
              <summary>
                Can I use this for billing and invoices?
                <span aria-hidden="true">+</span>
              </summary>
              <p>
                You can connect Checkout to your billing system to collect a
                USDT payment and keep its receipt with the order. Invoice
                creation, recurring subscriptions and tax calculations stay in
                your billing system.
              </p>
            </details>

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
          <p className="eyebrow">READY FOR YOUR FIRST PAYMENT</p>
          <h2>
            Make getting paid
            <br />
            feel <em>simple.</em>
          </h2>
          <a className="button button-primary" href="/register">
            Start accepting payments <span aria-hidden="true">&#8599;</span>
          </a>
          <p>
            Set up your business, connect your app, and create your first
            checkout.
          </p>
        </section>
      </main>
      <footer className="site-footer wrap">
        <a className="wordmark" href="#top">
          <img src="/mark.svg" alt="" width="28" height="28" />
          checkout.
        </a>
        <span>Your payments. Your business.</span>
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
