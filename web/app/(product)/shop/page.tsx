import { notFound } from 'next/navigation';
import { exampleShopEnabled } from '@/lib/deployment';
import { Shop } from '@/components/shop';
export const metadata = { title: 'Workshop' };
export default function ShopPage() {
  if (!exampleShopEnabled()) notFound();
  return <Shop />;
}
