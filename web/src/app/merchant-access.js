import { api, busy, clearError, showError } from './api.js';
import { signIn } from './wallet.js';

export function renderMerchantAccess(view, onSignedIn) {
  view.innerHTML = `<section class="access-grid"><div><p class="app-kicker">YOUR MERCHANT WORKSPACE</p><h1>Payments in.<br /><em>Everything in view.</em></h1><p class="app-lede">Track paid orders, resolve delivery issues, and return funds from one workspace.</p><ol class="access-features"><li><span>01</span> Know when a payment settles.</li><li><span>02</span> Recover orders after an outage.</li><li><span>03</span> Keep a record of every refund.</li></ol></div><aside class="purchase-card access-card"><p class="app-kicker">WELCOME BACK</p><h2>Your wallet.<br />Your workspace.</h2><p>Sign in with your registered payout wallet to access your business.</p><button id="merchant-sign-in" class="button button-primary full-width">Connect wallet &#8599;</button><p class="fine-print">Sign a message to log in. No transaction or network fee is required.</p><div class="access-divider"></div><h3>Connecting a new business?</h3><p>Set up your payout wallet and payment notifications.</p><a class="button button-outline full-width" href="/start">Get started &#8594;</a><a class="text-link access-preview" href="/merchant?view=example">Explore a workspace preview &#8599;</a></aside></section>`;
  document.querySelector('#merchant-sign-in').onclick = async (event) => {
    clearError();
    const release = busy(event.currentTarget, 'Check your wallet...');
    try {
      await signIn(api);
      await onSignedIn();
    } catch (error) {
      showError(error);
      release();
    }
  };
}
