import { parseUnits } from 'viem';
import {
  api,
  busy,
  showError,
  clearError,
  escapeHtml,
  money,
  shortAddress,
  orderLabel,
} from './api.js';
import { connectWallet, signAuthorization, signIn } from './wallet.js';
const label = (state) =>
  ({
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
  })[state] ?? state;
export async function renderMerchant(view) {
  document.title = 'Merchant workspace | Checkout';
  const config = await api('/v1/config');
  let authenticating = false;
  let session = null,
    data,
    activeId = null;
  async function load() {
    try {
      session = await api('/v1/session');
    } catch (error) {
      if (error.status !== 401) throw error;
      session = null;
    }
    if (session) {
      const [orders, deliveries] = await Promise.all([
        api('/v1/merchant/orders'),
        api('/v1/merchant/deliveries'),
      ]);
      data = {
        ...orders,
        ...deliveries,
        merchant: session.merchant,
        readOnly: false,
      };
    } else data = await api('/v1/demo');
  }
  await load();
  view.innerHTML = `<div class="workspace-title"><div><p class="app-kicker">MERCHANT WORKSPACE</p><h1>Orders, <em>accounted for.</em></h1><p class="app-lede">See what's paid, what's delivered, and what needs your attention.</p></div><button id="merchant-auth" class="button button-outline"></button></div><div id="workspace-mode" class="workspace-mode"></div><div id="workspace-stats" class="workspace-stats"></div><div class="orders-heading"><h2>Recent orders</h2><span>Updates every 10 seconds</span></div><div id="orders-table" class="orders-table"></div><section id="order-detail" class="workspace-detail" hidden></section>`;
  const authButton = document.querySelector('#merchant-auth');
  authButton.onclick = async () => {
    if (authenticating) return;
    authenticating = true;
    clearError();
    const release = busy(
      authButton,
      session ? 'Signing out...' : 'Check your wallet...',
    );
    try {
      if (session) await api('/v1/session/logout', {});
      else await signIn(api);
      await load();
      draw();
    } catch (error) {
      showError(error);
      release();
    } finally {
      authenticating = false;
    }
  };
  function draw() {
    authButton.disabled = false;
    authButton.textContent = session ? 'Sign out' : 'Connect merchant wallet';
    document.querySelector('#workspace-mode').innerHTML = data.readOnly
      ? `<span class="status-pill">Read-only demo</span><p>These are recorded test orders. Connect the registered merchant wallet to issue refunds or retry delivery.</p>`
      : `<span class="status-pill success">Signed in</span><p>Merchant wallet ${shortAddress(data.merchant.payout)}. Signing in never grants permission to spend USDT.</p>`;
    const confirmed = data.orders.filter((order) =>
      ['paid', 'partially_refunded', 'refunded'].includes(order.state),
    );
    const total = confirmed.reduce(
        (sum, order) => sum + BigInt(order.amount),
        0n,
      ),
      refunded = confirmed.reduce(
        (sum, order) => sum + BigInt(order.refunded),
        0n,
      );
    document.querySelector('#workspace-stats').innerHTML =
      `<div><span>Received in recent orders</span><strong>${money(total)} <small>USDT</small></strong></div><div><span>Refunded</span><strong>${money(refunded)} <small>USDT</small></strong></div><div><span>Awaiting fulfillment</span><strong>${confirmed.filter((order) => order.fulfillment !== 'fulfilled').length}</strong></div>`;
    document.querySelector('#orders-table').innerHTML = data.orders.length
      ? `<table><thead><tr><th>Order</th><th>Amount</th><th>Payment</th><th>Fulfillment</th><th><span class="sr-only">Details</span></th></tr></thead><tbody>${data.orders.map((order) => `<tr><td><strong>${escapeHtml(orderLabel(order.external_id))}</strong><small>${new Date(order.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</small></td><td>${money(order.amount)} USDT</td><td><span class="status-pill ${['paid', 'partially_refunded', 'refunded'].includes(order.state) ? 'success' : ''}">${label(order.state)}</span></td><td>${label(order.fulfillment)}</td><td><button class="table-action" data-order="${escapeHtml(order.id)}">Details &#8599;</button></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty-state"><h3>Your first order starts here.</h3><p>Create a checkout from your merchant server, or try the demo shop.</p><a class="text-link" href="/demo">Open demo shop &#8599;</a></div>';
    document.querySelectorAll('[data-order]').forEach(
      (button) =>
        (button.onclick = () => {
          activeId = button.dataset.order;
          drawDetail();
          document.querySelector('#order-detail').scrollIntoView({
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'auto'
              : 'smooth',
            block: 'start',
          });
        }),
    );
    if (activeId) drawDetail();
  }
  function drawDetail() {
    const order = data.orders.find((row) => row.id === activeId);
    if (!order) return;
    const detail = document.querySelector('#order-detail');
    detail.hidden = false;
    const deliveries = data.deliveries.filter(
        (row) => row.checkout_id === order.id,
      ),
      remaining = BigInt(order.amount) - BigInt(order.refunded);
    detail.innerHTML = `<div class="detail-header"><div><p class="app-kicker">ORDER DETAILS</p><h2>${escapeHtml(orderLabel(order.external_id))}</h2></div><a class="text-link" href="/checkout/${encodeURIComponent(order.id)}">Open receipt &#8599;</a></div><dl class="simple-facts detail-facts"><div><dt>Buyer</dt><dd>${escapeHtml(order.buyer ?? 'Not paid yet')}</dd></div><div><dt>Payment</dt><dd>${label(order.state)}</dd></div><div><dt>Fulfillment</dt><dd>${label(order.fulfillment)}</dd></div><div><dt>Refunded</dt><dd>${money(order.refunded)} USDT</dd></div></dl><div class="delivery-heading"><h3>Merchant notifications</h3><span>Delivery and fulfillment are tracked separately.</span></div><div class="delivery-list">${deliveries.length ? deliveries.map((delivery) => `<div class="delivery-item"><div><strong>${label(delivery.status)}</strong><p>${delivery.attempts} attempt${delivery.attempts === 1 ? '' : 's'}${delivery.last_http ? ' / HTTP ' + delivery.last_http : ''}</p></div><button class="button button-outline" data-retry="${escapeHtml(delivery.id)}" ${data.readOnly ? 'disabled' : ''}>Retry delivery</button></div>`).join('') : '<p class="muted">Notifications appear after payment confirmation.</p>'}</div><div class="refund-action"><div><h3>Refund this order</h3><p>Up to ${money(remaining)} USDT remains refundable. Your merchant wallet must sign.</p></div><button id="open-refund" class="button button-primary" ${data.readOnly || remaining <= 0n || !['paid', 'partially_refunded'].includes(order.state) ? 'disabled' : ''}>Issue a refund</button></div>${data.readOnly ? '<p class="fine-print">Sign in with the registered merchant wallet to use these controls.</p>' : ''}`;
    document.querySelectorAll('[data-retry]').forEach(
      (button) =>
        (button.onclick = async () => {
          clearError();
          const release = busy(button, 'Retrying...');
          try {
            await api(
              '/v1/merchant/deliveries/' +
                encodeURIComponent(button.dataset.retry) +
                '/retry',
              {},
            );
            await load();
            draw();
          } catch (error) {
            showError(error);
            release();
          }
        }),
    );
    document.querySelector('#open-refund').onclick = () =>
      refundDialog(order, remaining);
  }
  function refundDialog(order, remaining) {
    const dialog = document.createElement('dialog');
    dialog.className = 'refund-dialog';
    dialog.innerHTML = `<form><p class="app-kicker">MERCHANT-AUTHORIZED REFUND</p><h2>Return a little.<br />Or <em>all of it.</em></h2><p>Funds come from your merchant wallet. The receipt updates after confirmation.</p><label for="refund-amount">Amount in USDT</label><input id="refund-amount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0.50" required /><small>Maximum ${money(remaining)} USDT</small><p class="dialog-error" role="alert" hidden></p><button type="submit" class="button button-primary full-width">Review in wallet</button><button type="button" class="text-link" id="cancel-refund">Cancel</button></form>`;
    document.body.append(dialog);
    dialog.showModal();
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.querySelector('#cancel-refund').onclick = () => dialog.close();
    const refundId = crypto.randomUUID();
    let reservedAmount = null;
    dialog.querySelector('form').onsubmit = async (event) => {
      event.preventDefault();
      const input = dialog.querySelector('input').value.trim(),
        errorBox = dialog.querySelector('.dialog-error'),
        button = dialog.querySelector('[type="submit"]');
      errorBox.hidden = true;
      const release = busy(button, 'Check your wallet...');
      try {
        if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(input))
          throw Error(
            'Enter a USDT amount with no more than six decimal places.',
          );
        const amount = parseUnits(input, 6);
        if (amount <= 0n || amount > remaining)
          throw Error(
            'Choose an amount within the remaining refundable balance.',
          );
        const wallet = await connectWallet();
        if (wallet.address.toLowerCase() !== data.merchant.payout.toLowerCase())
          throw Error(
            'Switch to the merchant payout wallet before signing this refund.',
          );
        if (reservedAmount !== null && reservedAmount !== amount.toString())
          throw Error(
            'A refund for the previous amount is reserved. Close this form and review it before changing the amount.',
          );
        const refund = await api(
          `/v1/merchant/orders/${encodeURIComponent(order.id)}/refunds`,
          { refundId, amount: amount.toString() },
        );
        reservedAmount = amount.toString();
        const signature = await signAuthorization(refund.authorization, {
          from: wallet.address,
          token: config.token,
          router: config.router,
          amount,
        });
        await api(
          '/v1/merchant/refunds/' + encodeURIComponent(refund.id) + '/submit',
          { signature },
        );
        dialog.close();
        await load();
        draw();
        const region = document.querySelector('#app-message');
        region.textContent =
          'Refund submitted. The receipt will update after confirmation.';
        region.hidden = false;
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
        release();
      }
    };
  }
  draw();
  const timer = setInterval(async () => {
    if (
      authenticating ||
      document.hidden ||
      document.querySelector('dialog[open]')
    )
      return;
    try {
      const previous = JSON.stringify(data);
      await load();
      if (previous !== JSON.stringify(data)) draw();
    } catch (error) {
      showError(error);
    }
  }, 10000);
  window.addEventListener('pagehide', () => clearInterval(timer), {
    once: true,
  });
}
