'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export function ProductShell({
  children,
  showExample,
}: {
  children: React.ReactNode;
  showExample: boolean;
}) {
  const pathname = usePathname();
  const links = [
    ...(showExample ? [['/shop', 'Shop']] : []),
    ['/merchant', 'Merchant'],
    ['/start', 'Get started'],
    ['/docs', 'Docs'],
  ];
  return (
    <div className="product-app">
      <a className="skip-link" href="#app-main">
        Skip to content
      </a>
      <header className="app-header wrap">
        <Link className="wordmark" href="/">
          <img src="/mark.svg" width="30" height="30" alt="" />
          checkout.
        </Link>
        <nav aria-label="Product navigation">
          {links.map(([href, label]) => (
            <Link
              href={href}
              key={href}
              aria-current={
                pathname === href ||
                (href === '/docs' && pathname.startsWith('/docs/'))
                  ? 'page'
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="app-main" className="app-main wrap">
        {children}
      </main>
      <footer className="app-footer wrap">
        <span>USDT payments. Orders accounted for.</span>
        <Link href="/">About checkout &#8599;</Link>
      </footer>
    </div>
  );
}
