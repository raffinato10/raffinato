import type { Metadata } from "next";
import { getAllStockItemsAdmin } from "@/lib/db/stock";
import { getAllProductsAdmin, getLeafCategoriesForSelect } from "@/lib/db/admin";
import { EstoqueClient } from "./EstoqueClient";

export const metadata: Metadata = { title: "Estoque" };

export default async function EstoqueAdminPage() {
  const [stockItems, allProducts, categoryOptions] = await Promise.all([
    getAllStockItemsAdmin(),
    getAllProductsAdmin(),
    getLeafCategoriesForSelect(),
  ]);

  // Produtos legados/manuais (sem peça vinculada) continuam aparecendo aqui,
  // exatamente como antes — produtos vinculados a uma peça têm o estoque
  // gerenciado pela linha da peça, não pela linha do produto.
  const legacyProducts = allProducts.filter((p) => !p.stock_item_id);

  return (
    <EstoqueClient
      stockItems={stockItems}
      legacyProducts={legacyProducts}
      categoryOptions={categoryOptions}
    />
  );
}
