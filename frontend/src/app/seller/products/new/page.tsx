'use client';

import { PageTitle } from '@/components/DashboardShell';
import { EMPTY_PRODUCT, ProductForm } from '@/components/ProductForm';

export default function NewProductPage() {
  return (
    <>
      <PageTitle>Thêm sản phẩm mới</PageTitle>
      <ProductForm initial={EMPTY_PRODUCT} />
    </>
  );
}
