import './product.css';
import { mountShell } from './shell.js';
import { showError } from './api.js';
import { renderDemo } from './demo.js';
import { renderCheckout } from './checkout.js';
import { renderMerchant } from './merchant.js';
export async function startProduct() {
  const path = location.pathname.replace(/\/$/, '');
  const view = mountShell(path === '/merchant' ? 'merchant' : 'demo');
  try {
    if (path === '/demo') await renderDemo(view);
    else if (path === '/merchant') await renderMerchant(view);
    else if (/^\/checkout\/[^/]+$/.test(path))
      await renderCheckout(view, decodeURIComponent(path.split('/')[2]));
    else {
      view.innerHTML =
        '<h1>Page not found.</h1><a class="text-link" href="/demo">Open the demo shop</a>';
    }
  } catch (error) {
    view.innerHTML =
      '<div class="empty-state"><h1>We could not load this page.</h1><p>The service may be restarting. Refresh to try again.</p><a class="text-link" href="/">Back to home</a></div>';
    showError(error);
  }
}
