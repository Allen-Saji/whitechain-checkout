import { api, busy, showError, clearError, escapeHtml, money } from './api.js';
export async function renderDemo(view) {
  document.title = 'Demo workshop | Checkout';
  const product = await api('/shop-api/product');
  view.innerHTML = `<div class="app-kicker">THE DEMO SHOP</div><div class="shop-grid"><section class="shop-description"><p class="shop-category">A workshop for builders</p><h1>Build with<br /><em>stablecoins.</em></h1><p class="app-lede">Try a USDT purchase from start to finish. Follow the payment, see the order arrive, and explore the merchant's side.</p><div class="workshop-art" aria-hidden="true"><span class="workshop-art-number">01</span><div class="art-loop"></div><span>BUILD / PAY / CONNECT</span></div></section><aside class="purchase-card"><p class="app-kicker">DEMO WORKSHOP</p><h2>One seat.<br />The full payment flow.</h2><p class="purchase-price">${money(product.amount)} <span>USDT</span></p><dl class="simple-facts"><div><dt>Network</dt><dd>Whitechain Sepolia</dd></div><div><dt>Your gas fee</dt><dd>Covered by the relayer</dd></div><div><dt>Delivery</dt><dd>Recorded demo booking</dd></div></dl><button id="buy-seat" class="button button-primary full-width">Continue to checkout &#8594;</button><p class="fine-print">This is a test purchase. You will sign a USDT authorization in your wallet. No real event is being sold.</p><div id="last-checkout"></div></aside></div><div class="shop-after"><span>Want to see the other side?</span><a class="text-link" href="/merchant">Explore the merchant workspace &#8599;</a></div><div id="recorded-receipt" class="recorded-receipt"></div>`;
  const previous = sessionStorage.getItem('checkout:last');
  if (previous)
    document.querySelector('#last-checkout').innerHTML =
      `<a class="text-link" href="/checkout/${encodeURIComponent(previous)}">Return to your last order &#8599;</a>`;
  document
    .querySelector('#buy-seat')
    .addEventListener('click', async (event) => {
      clearError();
      const release = busy(event.currentTarget, 'Creating your checkout...');
      try {
        let orderId = sessionStorage.getItem('checkout:creating');
        if (!orderId) {
          orderId = crypto.randomUUID();
          sessionStorage.setItem('checkout:creating', orderId);
        }
        const order = await api('/shop-api/book', { orderId });
        sessionStorage.setItem('checkout:last', order.id);
        sessionStorage.removeItem('checkout:creating');
        location.assign('/checkout/' + encodeURIComponent(order.id));
      } catch (error) {
        showError(error);
        release();
      }
    });
  try {
    const demo = await api('/v1/demo');
    const paid = demo.orders.find((order) =>
      ['paid', 'partially_refunded', 'refunded'].includes(order.state),
    );
    if (paid)
      document.querySelector('#recorded-receipt').innerHTML =
        `<p class="app-kicker">ALREADY SETTLED ON TESTNET</p><p>Explore a completed payment and its recorded refund.</p><a class="text-link" href="/checkout/${encodeURIComponent(paid.id)}">View receipt ${escapeHtml(paid.external_id)} &#8599;</a>`;
  } catch {
    /* A configured shop can run without a public demo history. */
  }
}
