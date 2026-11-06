import { Checkout } from '@/components/checkout';
export const metadata = {
  title: 'Your order',
  robots: { index: false, follow: false },
};
export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Checkout key={id} id={id} />;
}
