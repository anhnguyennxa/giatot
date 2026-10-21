'use client';

import { useParams } from 'next/navigation';
import { PageTitle } from '@/components/DashboardShell';
import { ProductForm, type ProductInput } from '@/components/ProductForm';
import { Loading } from '@/components/ui';
import { useApi } from '@/lib/api';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useApi<ProductInput & { options: ProductInput['options'] | null }>(`/seller/products/${id}`);
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!data) return <Loading />;
  return (
    <>
      <PageTitle>Chỉnh sửa sản phẩm</PageTitle>
      <ProductForm initial={{
        id: data.id, name: data.name, categoryId: data.categoryId, brandId: data.brandId, description: data.description,
        price: data.price, originalPrice: data.originalPrice, stock: data.stock, weight: data.weight, images: data.images,
        options: data.options ?? [], freeShip: data.freeShip,
      }} />
    </>
  );
}
