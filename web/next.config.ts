import type { NextConfig } from 'next';
const apiOrigin = process.env.CHECKOUT_API_ORIGIN ?? 'http://127.0.0.1:4200';
const merchantOrigin =
  process.env.CHECKOUT_MERCHANT_ORIGIN ?? 'http://127.0.0.1:4301';
const config: NextConfig = {
  poweredByHeader: false,
  images: { formats: ['image/webp'], minimumCacheTTL: 86400 },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      {
        source: '/mark.svg',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/merchant/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/checkout/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: '/v1/:path*', destination: `${apiOrigin}/v1/:path*` },
      { source: '/shop-api/:path*', destination: `${merchantOrigin}/:path*` },
    ];
  },
};
export default config;
