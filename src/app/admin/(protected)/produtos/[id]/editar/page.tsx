import { notFound } from "next/navigation";
import { getProductByIdAdmin, getCategoryTreeForSelect } from "@/lib/db/admin";
import { EditarProdutoForm } from "./EditarProdutoForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarProdutoPage({ params }: Props) {
  const { id } = await params;

  const [product, categoryTree] = await Promise.all([
    getProductByIdAdmin(id),
    getCategoryTreeForSelect(),
  ]);

  if (!product) notFound();

  return <EditarProdutoForm product={product} categoryTree={categoryTree} />;
}
