"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const service = createServiceClient();
  const { data } = await service
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!data) throw new Error("Não autorizado");
}

export interface StockUpdateInput {
  // Uma linha por tamanho de uma cor (product_variant_sizes.stock)
  variantSizes: { id: string; stock: number }[];
  // Uma linha por produto sem variações — estoque simples (products.stock)
  flatProducts: { id: string; stock: number; stock_minimum: number }[];
}

// Atualização em lote das quantidades editadas na tela Admin > Estoque.
// Mesma regra de disponibilidade usada em updateProduct/createProduct
// (src/lib/actions/products.ts) pros produtos sem variação — produtos com
// variação nunca tiveram availability derivada do estoque (cada tamanho é
// independente, ver saveVariants em variants.ts), então essa ação também
// não mexe nisso.
export async function updateStockLevels(input: StockUpdateInput): Promise<{ error?: string }> {
  try {
    await assertAdmin();
  } catch {
    return { error: "Não autorizado." };
  }

  for (const s of input.variantSizes) {
    if (!Number.isInteger(s.stock) || s.stock < 0) {
      return { error: "Quantidade de estoque inválida." };
    }
  }
  for (const p of input.flatProducts) {
    if (!Number.isInteger(p.stock) || p.stock < 0) {
      return { error: "Quantidade de estoque inválida." };
    }
  }

  const service = createServiceClient();

  for (const s of input.variantSizes) {
    const { error } = await service
      .from("product_variant_sizes")
      .update({ stock: s.stock })
      .eq("id", s.id);
    if (error) return { error: error.message };
  }

  for (const p of input.flatProducts) {
    const availability =
      p.stock <= 0 ? "out_of_stock" : p.stock <= p.stock_minimum ? "low_stock" : "in_stock";
    const { error } = await service
      .from("products")
      .update({ stock: p.stock, availability })
      .eq("id", p.id);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/estoque");
  revalidatePath("/admin/produtos");

  return {};
}
