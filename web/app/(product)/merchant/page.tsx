import { MerchantWorkspace } from '@/components/merchant';
export const metadata = {
  title: 'Merchant workspace',
  robots: { index: false, follow: false },
};
export default async function MerchantPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return (
    <MerchantWorkspace key={view ?? 'account'} preview={view === 'example'} />
  );
}
