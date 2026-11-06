import type { NextConfig } from 'next';
const apiOrigin = process.env.CHECKOUT_API_ORIGIN ?? 'http://127.0.0.1:4200';
const merchantOrigin =
  process.env.CHECKOUT_MERCHANT_ORIGIN ?? 'http://127.0.0.1:4301';
const config: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: '/v1/:path*', destination: `${apiOrigin}/v1/:path*` },
      { source: '/shop-api/:path*', destination: `${merchantOrigin}/:path*` },
    ];
  },
};
export default config;
