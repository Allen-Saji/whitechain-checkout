import type { Metadata, Viewport } from 'next';
import '../styles/base.css';
export const metadata: Metadata = {
  title: {
    default: 'Checkout - USDT payments. Orders accounted for.',
    template: '%s | Checkout',
  },
  description:
    'USDT checkout with sponsored gas, recoverable order delivery and merchant-authorized refunds.',
  icons: { icon: '/mark.svg' },
};
export const viewport: Viewport = { themeColor: '#fcfaf7' };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
