import { exampleShopEnabled } from '@/lib/deployment';
import { ProductShell } from '@/components/product-shell';
import '../../styles/product.css';
export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProductShell showExample={exampleShopEnabled()}>{children}</ProductShell>
  );
}
