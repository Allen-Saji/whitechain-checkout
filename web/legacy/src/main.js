import './style.css';

const steps = [
  {
    fulfillment: 'Waiting for merchant',
    title: 'Payment received.',
    detail:
      'A confirmed receipt is recorded before your merchant app is notified.',
    counter: '01 / PAYMENT CONFIRMED',
    action: 'Simulate an outage',
    tone: 'paid',
  },
  {
    fulfillment: 'Retry queued',
    title: 'Your app is offline. The record stays.',
    detail:
      'Delivery failed. The same paid order waits safely in the delivery queue.',
    counter: '02 / DELIVERY PENDING',
    action: 'Bring the merchant back',
    tone: 'offline',
  },
  {
    fulfillment: 'Fulfilled',
    title: 'Back online. Booking confirmed.',
    detail:
      'The merchant receives the event and creates one booking. No second charge.',
    counter: '03 / ORDER RECOVERED',
    action: 'Replay the walkthrough',
    tone: 'recovered',
  },
];
const tabs = [...document.querySelectorAll('[data-step]')];
const panel = document.querySelector('#flow-panel');
const advance = document.querySelector('#advance-demo');
let current = 0;
function selectStep(index, focus = false) {
  current = index;
  const step = steps[index];
  tabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(i === index));
    tab.tabIndex = i === index ? 0 : -1;
  });
  panel.setAttribute('aria-labelledby', tabs[index].id);
  panel.dataset.tone = step.tone;
  document.querySelector('#fulfillment-state').textContent = step.fulfillment;
  document.querySelector('#event-title').textContent = step.title;
  document.querySelector('#event-detail').textContent = step.detail;
  document.querySelector('#event-counter').textContent = step.counter;
  advance.replaceChildren(document.createTextNode(step.action + ' '));
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '\u2192';
  advance.append(arrow);
  if (focus) tabs[index].focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectStep(index));
  tab.addEventListener('keydown', (event) => {
    const directions = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    };
    if (event.key in directions) {
      event.preventDefault();
      selectStep(
        (index + directions[event.key] + steps.length) % steps.length,
        true,
      );
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      selectStep(event.key === 'Home' ? 0 : steps.length - 1, true);
    }
  });
});
advance.addEventListener('click', () =>
  selectStep((current + 1) % steps.length),
);
const snippet = `import { checkoutClient } from './sdk/server.mjs';

const checkout = checkoutClient({
  baseUrl: process.env.CHECKOUT_API,
  apiKey: process.env.MERCHANT_API_KEY,
});

const order = await checkout.create({
  orderId: 'workshop-001',
  amount: '2000000', // 2 USDT, in base units
});`;
document.querySelector('#integration-code').textContent = snippet;
const copy = document.querySelector('#copy-code');
copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(snippet);
    copy.textContent = 'Copied';
  } catch {
    copy.textContent = 'Select code to copy';
  }
  setTimeout(() => {
    copy.textContent = 'Copy';
  }, 2200);
});
const menuButton = document.querySelector('.menu-toggle'),
  mobileNav = document.querySelector('#mobile-nav');
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation');
  mobileNav.hidden = true;
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute(
    'aria-label',
    open ? 'Close navigation' : 'Open navigation',
  );
  mobileNav.hidden = !open;
});
mobileNav
  .querySelectorAll('a')
  .forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !mobileNav.hidden) {
    closeMenu();
    menuButton.focus();
  }
});
window.matchMedia('(min-width: 761px)').addEventListener('change', (event) => {
  if (event.matches) closeMenu();
});
document
  .querySelector('#download-pdf')
  .addEventListener('click', () => window.print());

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll('.reveal').forEach((element) => {
    element.classList.add('will-reveal');
    observer.observe(element);
  });
  reducedMotion.addEventListener('change', (event) => {
    if (event.matches) {
      document
        .querySelectorAll('.reveal')
        .forEach((element) => element.classList.add('visible'));
      observer.disconnect();
    }
  });
}
