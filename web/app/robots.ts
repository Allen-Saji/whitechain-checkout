import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/merchant', '/checkout/', '/v1/', '/shop-api/'],
    },
    sitemap: siteUrl + '/sitemap.xml',
  };
}
