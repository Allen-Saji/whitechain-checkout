export const metadata = { title: 'Get started' };
export default function SetupPage() {
  return (
    <>
      <section className="setup-heading">
        <p className="app-kicker">BUILD WITH CHECKOUT</p>
        <h1>
          Your business.
          <br />
          <em>Connected.</em>
        </h1>
        <p className="app-lede">
          Keep your storefront and fulfillment. Add USDT payments, receipts, and
          a workspace for what happens next.
        </p>
      </section>
      <div className="setup-grid">
        <section className="setup-steps">
          <article>
            <span className="app-kicker">01 / MERCHANT ACCOUNT</span>
            <h2>Choose where payments arrive.</h2>
            <p>
              Your payout wallet receives customer payments and signs refunds.
              Create your account with a wallet signature, then connect your
              HTTPS notification endpoint in settings.
            </p>
            <a className="text-link" href="/register">
              Create merchant account &#8599;
            </a>
          </article>
          <article>
            <span className="app-kicker">02 / SERVER INTEGRATION</span>
            <h2>Create a checkout.</h2>
            <p>
              Set the price on your server, create an order with a stable ID,
              and send the customer to its checkout URL. Keep your API key on
              the server.
            </p>
            <pre className="setup-code">
              <code>{`const order = await checkout.create({\n  orderId: "booking-1042",\n  amount: "2000000"\n});\n\n// Redirect your customer to order.checkoutUrl`}</code>
            </pre>
          </article>
          <article>
            <span className="app-kicker">03 / FULFILLMENT</span>
            <h2>Connect the handoff.</h2>
            <p>
              Verify signed notifications, fulfill each order once, and
              acknowledge completion. If your server is unavailable,
              notifications are retried.
            </p>
            <a className="text-link" href="/docs/webhooks">
              View the complete integration &#8599;
            </a>
          </article>
        </section>
        <aside className="purchase-card setup-aside">
          <p className="app-kicker">BEFORE YOU BEGIN</p>
          <h2>A short checklist.</h2>
          <ul className="setup-checklist">
            <li>A payout wallet you control</li>
            <li>A server for prices and order creation</li>
            <li>An HTTPS notification endpoint</li>
            <li>USDT for merchant-authorized refunds</li>
          </ul>
          <dl className="simple-facts">
            <div>
              <dt>Network</dt>
              <dd>Whitechain Sepolia</dd>
            </div>
            <div>
              <dt>Customer gas</dt>
              <dd>Sponsored</dd>
            </div>
            <div>
              <dt>Settlement</dt>
              <dd>To your wallet</dd>
            </div>
          </dl>
          <a className="button button-primary full-width" href="/merchant">
            Open workspace &#8599;
          </a>
          <a className="text-link access-preview" href="/shop">
            Explore checkout &#8599;
          </a>
        </aside>
      </div>
    </>
  );
}
