import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export const alt = 'Checkout - Get paid in USDT. Stay in control.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-static';
export default async function Image() {
  const font = await readFile(
    join(process.cwd(), 'public/fonts/dm-sans-semibold.ttf'),
  ).catch(() =>
    readFile(join(process.cwd(), 'web/public/fonts/dm-sans-semibold.ttf')),
  );
  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        background: '#fcfaf7',
        color: '#24201e',
        padding: 64,
        fontFamily: 'DM Sans',
        position: 'relative',
        flexDirection: 'column',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 15, fontSize: 34 }}
      >
        <svg width="45" height="45" viewBox="0 0 40 40">
          <path d="M5 17 34 4v17L10 29l-5-3Z" fill="#d83c1b" />
          <path d="m5 17 5 12v7l-5-6Z" fill="#a42c17" />
        </svg>
        checkout.
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontSize: 82,
          lineHeight: 1.08,
          marginTop: 76,
          letterSpacing: -4,
        }}
      >
        <span>Get paid in USDT.</span>
        <span style={{ color: '#d83c1b' }}>Stay in control.</span>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 24,
          marginTop: 36,
          color: '#6d665f',
        }}
      >
        Hosted checkout. Payment tracking. Receipts and refunds.
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 'auto',
          fontSize: 19,
          borderTop: '1px solid #dfd8d0',
          paddingTop: 20,
          justifyContent: 'space-between',
        }}
      >
        <span>Payments for your product</span>
        <span>checkout.allensaji.dev</span>
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: 'DM Sans', data: font, weight: 600, style: 'normal' }],
    },
  );
}
