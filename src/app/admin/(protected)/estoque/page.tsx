import type { Metadata } from "next";
import { getAllProductsAdmin, getCategoryTreeForSelect } from "@/lib/db/admin";
import { EstoqueClient } from "./EstoqueClient";

export const metadata: Metadata = { title: "Estoque" };

export default async function EstoqueAdminPage() {
  const [products, categoryTree] = await Promise.all([
    getAllProductsAdmin(),
    getCategoryTreeForSelect(),
  ]);

  return <EstoqueClient initialProducts={products} categoryTree={categoryTree} />;
}
