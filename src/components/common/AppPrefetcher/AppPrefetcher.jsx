import { useEffect } from 'react';

const routes = [
  [/^\/producto\//, () => import('../../../pages/ProductPage')],
  [/^\/carrito\/?$/, () => import('../../../pages/CartPage')],
  [/^\/editor\//, () => import('../../../pages/EditorPage')],
  [/^\/personalizar\/?$/, () => import('../../../pages/PersonalizarPage')],
  [/^\/checkout\/?$/, () => import('../../../pages/CheckoutPage')],
];

// CPU idle does not mean network idle. Only prefetch on navigation intent.
export default function AppPrefetcher() {
  useEffect(() => {
    const pending = new Set();
    const prefetch = (event) => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor || navigator.connection?.saveData) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) return;
      const route = routes.find(([pattern]) => pattern.test(url.pathname));
      if (!route || pending.has(route)) return;
      pending.add(route);
      route[1]().catch(() => pending.delete(route));
    };
    const events = ['pointerover', 'focusin', 'pointerdown'];
    events.forEach((name) => document.addEventListener(name, prefetch, { passive: true }));
    return () => events.forEach((name) => document.removeEventListener(name, prefetch));
  }, []);
  return null;
}
