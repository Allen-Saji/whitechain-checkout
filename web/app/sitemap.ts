import type { MetadataRoute } from 'next';
import { pages } from '@/lib/docs';
import { siteUrl } from '@/lib/site';
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    '',
    '/start',
    '/register',
    '/docs',
    ...pages.filter((p) => p.slug !== 'overview').map((p) => '/docs/' + p.slug),
  ].map((path) => ({ url: siteUrl + path }));
}
