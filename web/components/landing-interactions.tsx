'use client';
import { useEffect } from 'react';
const snippet = `import { checkoutClient } from './sdk/server.mjs';

const checkout = checkoutClient({
  baseUrl: process.env.CHECKOUT_API,
  apiKey: process.env.CHECKOUT_API_KEY,
});

const order = await checkout.create({
  orderId: 'workshop-001',
  amount: '2000000', // 2 USDT, in base units
});`;
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
export function LandingInteractions() {
  useEffect(() => {
    const controller = new AbortController(),
      options = { signal: controller.signal };
    const get = <T extends HTMLElement = HTMLElement>(selector: string) => {
      const e = document.querySelector<T>(selector);
      if (!e) throw Error('Missing landing element ' + selector);
      return e;
    };
    const tabs = [
        ...document.querySelectorAll<HTMLButtonElement>('[data-step]'),
      ],
      panel = get('#flow-panel'),
      advance = get('#advance-demo');
    let current = 0;
    function select(index: number, focus = false) {
      current = index;
      const step = steps[index];
      tabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', tabs[index].id);
      panel.dataset.tone = step.tone;
      get('#fulfillment-state').textContent = step.fulfillment;
      get('#event-title').textContent = step.title;
      get('#event-detail').textContent = step.detail;
      get('#event-counter').textContent = step.counter;
      advance.textContent = step.action + ' \u2192';
      if (focus) tabs[index].focus();
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(index), options);
      tab.addEventListener(
        'keydown',
        (event) => {
          const directions: Record<string, number> = {
            ArrowDown: 1,
            ArrowRight: 1,
            ArrowUp: -1,
            ArrowLeft: -1,
          };
          if (event.key in directions) {
            event.preventDefault();
            select(
              (index + directions[event.key] + steps.length) % steps.length,
              true,
            );
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            select(event.key === 'Home' ? 0 : steps.length - 1, true);
          }
        },
        options,
      );
    });
    advance.addEventListener(
      'click',
      () => select((current + 1) % steps.length),
      options,
    );
    get('#integration-code').textContent = snippet;
    const copy = get('#copy-code');
    copy.addEventListener(
      'click',
      async () => {
        try {
          await navigator.clipboard.writeText(snippet);
          if (!controller.signal.aborted) copy.textContent = 'Copied';
        } catch {
          if (!controller.signal.aborted)
            copy.textContent = 'Select code to copy';
        }
      },
      options,
    );
    const menu = get('.menu-toggle'),
      nav = get('#mobile-nav');
    function close() {
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', 'Open navigation');
      nav.hidden = true;
    }
    menu.addEventListener(
      'click',
      () => {
        const open = menu.getAttribute('aria-expanded') !== 'true';
        menu.setAttribute('aria-expanded', String(open));
        menu.setAttribute(
          'aria-label',
          open ? 'Close navigation' : 'Open navigation',
        );
        nav.hidden = !open;
      },
      options,
    );
    nav
      .querySelectorAll('a')
      .forEach((link) => link.addEventListener('click', close, options));
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape' && !nav.hidden) {
          close();
          menu.focus();
        }
      },
      options,
    );
    window.matchMedia('(min-width: 761px)').addEventListener(
      'change',
      (event) => {
        if (event.matches) close();
      },
      options,
    );
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | undefined;
    if ('IntersectionObserver' in window && !reduced.matches) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12 },
      );
      document.querySelectorAll('.reveal').forEach((element) => {
        element.classList.add('will-reveal');
        observer?.observe(element);
      });
      reduced.addEventListener(
        'change',
        (event) => {
          if (event.matches) {
            document
              .querySelectorAll('.reveal')
              .forEach((e) => e.classList.add('visible'));
            observer?.disconnect();
          }
        },
        options,
      );
    }
    return () => {
      controller.abort();
      observer?.disconnect();
      document
        .querySelectorAll('.will-reveal')
        .forEach((e) => e.classList.remove('will-reveal'));
    };
  }, []);
  return null;
}
