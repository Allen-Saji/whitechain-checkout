import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { siteUrl, siteDescription } from '@/lib/site';
import '../styles/base.css';
const sans = localFont({
  src: [
    { path: '../public/fonts/dm-sans-regular.ttf', weight: '400' },
    { path: '../public/fonts/dm-sans-semibold.ttf', weight: '600' },
  ],
  variable: '--font-sans',
  display: 'swap',
});
const serif = localFont({
  src: '../public/fonts/instrument-serif-italic.ttf',
  weight: '400',
  style: 'italic',
  variable: '--font-serif',
  display: 'swap',
});
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Checkout - USDT payments for your business.',
    template: '%s | Checkout',
  },
  description: siteDescription,
  applicationName: 'Checkout',
  icons: { icon: [{ url: '/mark.svg', type: 'image/svg+xml' }] },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Checkout',
    title: 'Checkout - USDT payments for your business.',
    description: siteDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Checkout - USDT payments for your business.',
    description: siteDescription,
  },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { themeColor: '#fcfaf7' };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        {children}
        <div id="wallet-dialog-root" />
      </body>
    </html>
  );
}
