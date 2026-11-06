import {
  api,
  busy,
  showError,
  clearError,
  escapeHtml,
  money,
  shortAddress,
  transactionLink,
  explainCode,
  orderLabel,
} from './api.js';
import { connectWallet, tokenBalance, signAuthorization } from './wallet.js';
const paidStates = new Set(['paid', 'partially_refunded', 'refunded']);
export async function renderCheckout(view, id) {
  const config = await api('/v1/config');
  let order = await api('/v1/checkouts/' + encodeURIComponent(id)),
    connected = null,
    paying = false;
  document.title = 'Your order | Checkout';
  view.innerHTML = `<a class="back-link" href="/demo">&#8592; Back to the demo shop</a><div class="checkout-heading"><p class="app-kicker">WORKSHOP BOOKING</p><h1 id="checkout-title">Review your <em>order.</em></h1><p id="checkout-description" class="app-lede">Pay in USDT. We'll cover the network fee.</p></div><div class="checkout-grid"><section class="checkout-summary"><div class="summary-top"><span class="order-monogram">W</span><div><h2>Build with stablecoins</h2><p>One demo workshop seat</p></div></div><dl class="simple-facts"><div><dt>Order</dt><dd>${escapeHtml(orderLabel(order.orderId))}</dd></div><div><dt>Merchant wallet</dt><dd title="${escapeHtml(order.merchant)}">${shortAddress(order.merchant)}</dd></div><div><dt>Amount</dt><dd>${money(order.amount)} USDT</dd></div><div><dt>Customer gas fee</dt><dd>Covered by relayer</dd></div><div><dt>Network</dt><dd>Whitechain Sepolia</dd></div></dl><div id="receipt-status" class="receipt-status"></div><div id="receipt-timeline" class="receipt-timeline"></div></section><aside class="payment-card"><div id="payment-content"></div><div class="payment-boundary"><p>Your USDT goes directly to the merchant.</p><p>Refunds require the merchant's approval and available funds.</p></div><a class="text-link" href="/merchant">Merchant workspace &#8599;</a></aside></div>`;
  function draw() {
    const paid = paidStates.has(order.state),
      queued = order.state === 'queued',
      expired = order.expiresAt <= Date.now() / 1000 && !paid && !queued;
    document.querySelector('#checkout-title').innerHTML = paid
      ? 'Payment <em>received.</em>'
      : queued
        ? 'Payment <em>in progress.</em>'
        : 'Review your <em>order.</em>';
    document.querySelector('#checkout-description').textContent = paid
      ? order.fulfillment === 'fulfilled'
        ? 'Your demo booking is confirmed. Your receipt is below.'
        : 'Your payment is confirmed. We are waiting for the merchant to finish your order.'
      : queued
        ? 'Your signed payment is being processed. You can return to this page at any time.'
        : "Pay in USDT. We'll cover the network fee.";
    document.querySelector('#receipt-status').innerHTML =
      `<div><span>Payment</span><strong class="status-pill ${paid ? 'success' : ''}">${paid ? 'Confirmed' : queued ? 'Processing' : order.state === 'failed' ? 'Needs attention' : expired ? 'Expired' : 'Not paid'}</strong></div><div><span>Fulfillment</span><strong>${order.fulfillment === 'fulfilled' ? 'Booking confirmed' : order.fulfillment === 'unavailable' ? 'Merchant unavailable' : paid ? 'Waiting for merchant' : 'Not started'}</strong></div>${BigInt(order.refunded) > 0n ? `<div><span>Refunded</span><strong>${money(order.refunded)} USDT</strong></div>` : ''}`;
    document.querySelector('#receipt-timeline').innerHTML = order.timeline
      .map((event) => {
        const url = transactionLink(event.transactionHash);
        return `<a href="${url ?? '#'}" target="_blank" rel="noopener noreferrer"><span>${event.type === 'Paid' ? 'Payment confirmed' : 'Refund confirmed'}<small>Block ${event.blockNumber}</small></span><span>View transaction &#8599;</span></a>`;
      })
      .join('');
    const card = document.querySelector('#payment-content');
    if (paid) {
      card.innerHTML = `<span class="receipt-success-mark" aria-hidden="true">&#10003;</span><p class="app-kicker">PAYMENT RECEIPT</p><h2>${money(order.amount)} <em>USDT</em></h2><p class="card-description">${order.fulfillment === 'fulfilled' ? 'The merchant has confirmed your booking.' : 'The payment is recorded. Delivery will be retried if the merchant is temporarily offline.'}</p><button class="button button-outline full-width" id="print-receipt">Print receipt</button>`;
      document.querySelector('#print-receipt').onclick = () => window.print();
    } else if (queued) {
      card.innerHTML =
        '<div class="processing-dot" aria-hidden="true"></div><h2>Checking the<br /><em>payment.</em></h2><p class="card-description">No need to sign again. This page will update when the transaction is confirmed.</p>';
    } else if (expired || order.state === 'failed') {
      card.innerHTML = `<p class="app-kicker">${expired ? 'CHECKOUT EXPIRED' : 'PAYMENT NEEDS ATTENTION'}</p><h2>Let's check<br /><em>what happened.</em></h2><p class="card-description">${escapeHtml(expired ? 'The payment window ended. Start a new order to continue.' : explainCode(order.paymentJob?.error))}</p><a class="button button-outline full-width" href="/demo">Return to shop</a>`;
    } else {
      card.innerHTML = `<p class="app-kicker">TOTAL TO PAY</p><h2>${money(order.amount)} <em>USDT</em></h2><button class="wallet-connect" id="connect-buyer">${connected ? shortAddress(connected.address) + ' - reconnect' : 'Connect your wallet'} <span>&#8599;</span></button><p class="wallet-balance" id="buyer-balance">${connected ? escapeHtml(connected.balance) + ' USDT available' : config.relayEnabled ? 'Use a wallet holding test USDT on Whitechain Sepolia.' : 'The demo relayer is paused. Payments are not being submitted.'}</p><button id="pay-order" class="button button-primary full-width" ${!connected || paying || !config.relayEnabled ? 'disabled' : ''}>${paying ? 'Check your wallet...' : 'Pay ' + money(order.amount) + ' USDT'}</button><p class="fine-print">You'll sign one payment authorization. This does not grant an unlimited token allowance.</p>`;
      document.querySelector('#connect-buyer').onclick = async (event) => {
        clearError();
        const release = busy(event.currentTarget, 'Connecting...');
        try {
          const wallet = await connectWallet();
          connected = {
            address: wallet.address,
            balance: money(await tokenBalance(wallet.address, config.token)),
          };
          draw();
        } catch (error) {
          showError(error);
          release();
        }
      };
      document.querySelector('#pay-order').onclick = pay;
    }
  }
  async function pay() {
    clearError();
    paying = true;
    draw();
    try {
      const wallet = await connectWallet();
      if (wallet.address.toLowerCase() !== connected.address.toLowerCase())
        throw Error(
          'The selected account changed. Connect it again to review its balance.',
        );
      if (
        (await tokenBalance(wallet.address, config.token)) <
        BigInt(order.amount)
      )
        throw Error(
          'This wallet does not have enough test USDT. Add funds, then try again.',
        );
      const auth = await api(
        `/v1/checkouts/${encodeURIComponent(id)}/authorization`,
        { payer: wallet.address },
      );
      const signature = await signAuthorization(auth, {
        from: wallet.address,
        token: config.token,
        router: config.router,
        amount: order.amount,
      });
      await api(`/v1/checkouts/${encodeURIComponent(id)}/pay`, {
        payer: wallet.address,
        signature,
      });
      order = await api('/v1/checkouts/' + encodeURIComponent(id));
    } catch (error) {
      showError(error);
      try {
        order = await api('/v1/checkouts/' + encodeURIComponent(id));
      } catch {
        /* Keep last known receipt; do not submit a second payment. */
      }
    } finally {
      paying = false;
      draw();
    }
  }
  draw();
  const timer = setInterval(async () => {
    if (paying || document.hidden) return;
    try {
      const next = await api('/v1/checkouts/' + encodeURIComponent(id));
      if (JSON.stringify(next) !== JSON.stringify(order)) {
        order = next;
        draw();
      }
    } catch (error) {
      showError(error);
    }
  }, 5000);
  window.addEventListener('pagehide', () => clearInterval(timer), {
    once: true,
  });
}
