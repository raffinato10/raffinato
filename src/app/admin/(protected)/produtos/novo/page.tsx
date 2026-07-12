import { getCategoryTreeForSelect } from "@/lib/db/admin";
import { getProductDataForDuplication } from "@/lib/actions/products";
import { NovoProdutoForm } from "./NovoProdutoForm";

interface Props {
  searchParams: Promise<{ duplicate?: string }>;
}

export default async function NovoProdutoPage({ searchParams }: Props) {
  const { duplicate } = await searchParams;

  const [categoryTree, duplicateFrom] = await Promise.all([
    getCategoryTreeForSelect(),
    duplicate ? getProductDataForDuplication(duplicate) : Promise.resolve(null),
  ]);

  return (
    <NovoProdutoForm
      categoryTree={categoryTree}
      duplicateFrom={duplicateFrom}
      duplicateFromId={duplicate}
    />
  );
}
