import { ProductShell } from '@/components/product-shell';
import '../../styles/product.css';
export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProductShell>{children}</ProductShell>;
}
