"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getInventoryMovementsForStockItem, searchStockItemsForLink as dbSearchStockItemsForLink, getStockItemByIdAdmin } from "@/lib/db/stock";
import type { InventoryMovement, StockItem } from "@/types";
import type { StockItemSearchResult } from "@/lib/db/stock";

const BUCKET = "product-images";
const STORAGE_MARKER = `/storage/v1/object/public/${BUCKET}/`;

function extractStoragePath(url: string): string | undefined {
  const idx = url.indexOf(STORAGE_MARKER);
  if (idx === -1) return undefined;
  return url.slice(idx + STORAGE_MARKER.length);
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const service = createServiceClient();
  const { data: profile } = await service
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Não autorizado");

  return service;
}

export interface StockItemFormData {
  name: string;
  base_sku: string;
  category_id?: string | null;
  is_active: boolean;
}

export async function createStockItem(
  data: StockItemFormData
): Promise<{ error?: string; id?: string }> {
  let service: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    service = await requireAdmin();
  } catch {
    return { error: "Não autorizado" };
  }

  if (!data.name.trim()) return { error: "Nome é obrigatório." };
  if (!data.base_sku.trim()) return { error: "SKU base é obrigatório." };

  const { data: row, error } = await service
    .from("stock_items")
    .insert({
      name: data.name.trim(),
      base_sku: data.base_sku.trim().toUpperCase(),
      category_id: data.category_id || null,
      is_active: data.is_active,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Já existe uma peça com esse SKU base." };
    return { error: error.message };
  }

  revalidatePath("/admin/estoque");
  return { id: row?.id };
}

export async function updateStockItem(
  id: string,
  data: StockItemFormData
): Promise<{ error?: string }> {
  let service: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    service = await requireAdmin();
  } catch {
    return { error: "Não autorizado" };
  }

  if (!data.name.trim()) return { error: "Nome é obrigatório." };
  if (!data.base_sku.trim()) return { error: "SKU base é obrigatório." };

  const { error } = await service
    .from("stock_items")
    .update({
      name: data.name.trim(),
      base_sku: data.base_sku.trim().toUpperCase(),
      category_id: data.category_id || null,
      is_active: data.is_active,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "Já existe uma peça com esse SKU base." };
    return { error: error.message };
  }

  revalidatePath("/admin/estoque");
  revalidatePath("/produtos/[slug]", "page");
  revalidatePath("/");
  return {};
}

export async function searchStockItemsForLink(term: string): Promise<StockItemSearchResult[] | { error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Não autorizado" };
  }
  return dbSearchStockItemsForLink(term);
}

export async function getStockItemForLinkPreview(id: string): Promise<StockItem | { error: string } | null> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Não autorizado" };
  }
  return getStockItemByIdAdmin(id);
}

export async function getStockItemHistory(stockItemId: string): Promise<InventoryMovement[] | { error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Não autorizado" };
  }
  return getInventoryMovementsForStockItem(stockItemId);
}

export async function deleteStockItem(id: string): Promise<{ error?: string }> {
  let service: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    service = await requireAdmin();
  } catch {
    return { error: "Não autorizado" };
  }

  const { data: linkedProduct } = await service
    .from("products")
    .select("id, name")
    .eq("stock_item_id", id)
    .maybeSingle();

  if (linkedProduct) {
    return {
      error: `Esta peça está vinculada ao produto "${linkedProduct.name}". Desvincule ou exclua o produto antes de remover a peça.`,
    };
  }

  // Coleta as imagens de todas as cores desta peça antes de excluir — o ON
  // DELETE CASCADE (stock_items → product_variants → product_variant_media/
  // _sizes) limpa as linhas do banco, mas não os arquivos no Storage.
  const { data: variantRows } = await service
    .from("product_variants")
    .select("id")
    .eq("stock_item_id", id);
  const variantIds = (variantRows ?? []).map((v) => v.id);

  let mediaUrls: string[] = [];
  if (variantIds.length > 0) {
    const { data: media } = await service
      .from("product_variant_media")
      .select("url")
      .in("variant_id", variantIds);
    mediaUrls = (media ?? []).map((m) => m.url);
  }

  const { error } = await service.from("stock_items").delete().eq("id", id);
  if (error) return { error: error.message };

  if (mediaUrls.length > 0) {
    const { data: stillUsed } = await service
      .from("product_variant_media")
      .select("url")
      .in("url", mediaUrls);
    const referencedElsewhere = new Set((stillUsed ?? []).map((r) => r.url));
    const storagePaths = mediaUrls
      .filter((url) => !referencedElsewhere.has(url))
      .map(extractStoragePath)
      .filter((p): p is string => !!p);
    if (storagePaths.length > 0) {
      await service.storage.from(BUCKET).remove(storagePaths);
    }
  }

  revalidatePath("/admin/estoque");
  return {};
}
