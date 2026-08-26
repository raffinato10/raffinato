import type { Metadata } from "next";
import { getAllProductsAdmin } from "@/lib/db/admin";
import { EstoqueClient } from "./EstoqueClient";

export const metadata: Metadata = { title: "Estoque" };

export default async function EstoqueAdminPage() {
  const products = await getAllProductsAdmin();

  return <EstoqueClient initialProducts={products} />;
}
