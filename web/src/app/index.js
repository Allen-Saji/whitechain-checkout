import './product.css';
import { mountShell } from './shell.js';
import { showError } from './api.js';
import { renderDemo } from './demo.js';
import { renderCheckout } from './checkout.js';
import { renderDocs } from '../docs/index.js';
import { renderSetup } from './setup.js';
import { renderMerchant } from './merchant.js';
export async function startProduct() {
  const path = location.pathname.replace(/\/$/, '');
  const active = path.startsWith('/docs')
    ? 'docs'
    : path === '/start'
      ? 'start'
      : path === '/merchant'
        ? 'merchant'
        : 'shop';
  const view = mountShell(active);
  try {
    if (path === '/demo' || path === '/shop') await renderDemo(view);
    else if (path === '/docs' || path.startsWith('/docs/'))
      renderDocs(view, path.split('/')[2] || 'overview');
    else if (path === '/start') renderSetup(view);
    else if (path === '/merchant') await renderMerchant(view);
    else if (/^\/checkout\/[^/]+$/.test(path))
      await renderCheckout(view, decodeURIComponent(path.split('/')[2]));
    else {
      view.innerHTML =
        '<h1>Page not found.</h1><a class="text-link" href="/shop">Open shop</a>';
    }
  } catch (error) {
    view.innerHTML =
      '<div class="empty-state"><h1>We could not load this page.</h1><p>The service may be restarting. Refresh to try again.</p><a class="text-link" href="/">Back to home</a></div>';
    showError(error);
  }
}
