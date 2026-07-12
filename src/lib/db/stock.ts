// Repositório de peças de estoque (stock_items) — usa service client
// (bypassa RLS), exclusivo para Server Components/Actions do painel admin.

import { createServiceClient } from "@/lib/supabase/server";
import { VARIANT_FIELDS, toVariant } from "@/lib/db/variant-mappers";
import type { StockItem, InventoryMovement, InventoryMovementType } from "@/types";
import type { DbStockItem } from "@/types/database.types";
import type { VariantRowWithRelations } from "@/lib/db/variant-mappers";

const STOCK_ITEM_FIELDS = `
  id, name, base_sku, category_id, is_active, created_at, updated_at,
  product_variants ( ${VARIANT_FIELDS} ),
  products ( id, name, slug )
` as const;

type StockItemRow = DbStockItem & {
  product_variants?: VariantRowWithRelations[];
  products?: { id: string; name: string; slug: string }[];
};

function toStockItem(row: StockItemRow): StockItem {
  return {
    id:          row.id,
    name:        row.name,
    base_sku:    row.base_sku,
    category_id: row.category_id ?? undefined,
    is_active:   row.is_active,
    variants: (row.product_variants ?? [])
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map(toVariant),
    linked_product: row.products?.[0]
      ? { id: row.products[0].id, name: row.products[0].name, slug: row.products[0].slug }
      : undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getAllStockItemsAdmin(): Promise<StockItem[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("stock_items")
    .select(STOCK_ITEM_FIELDS)
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => toStockItem(row as StockItemRow));
}

export async function getStockItemByIdAdmin(id: string): Promise<StockItem | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("stock_items")
    .select(STOCK_ITEM_FIELDS)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data ? toStockItem(data as StockItemRow) : null;
}

export interface StockItemSearchResult {
  id: string;
  name: string;
  base_sku: string;
  colorCount: number;
  skuCount: number;
  totalStock: number;
  linkedProductId?: string;
}

// Busca peças por nome/SKU base — usado pelo picker "vincular produto a uma
// peça do estoque". Inclui peças já vinculadas (linkedProductId preenchido)
// pra a UI poder desabilitá-las, exceto a do próprio produto em edição.
export async function searchStockItemsForLink(term: string): Promise<StockItemSearchResult[]> {
  const supabase = createServiceClient();
  const cleaned = term.trim();

  let query = supabase
    .from("stock_items")
    .select(`
      id, name, base_sku, is_active,
      product_variants ( id, product_variant_sizes ( stock ) ),
      products ( id )
    `)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(15);

  if (cleaned) {
    query = query.or(`name.ilike.%${cleaned}%,base_sku.ilike.%${cleaned}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    id: string;
    name: string;
    base_sku: string;
    product_variants?: { id: string; product_variant_sizes?: { stock: number }[] }[];
    products?: { id: string }[];
  };

  return ((data ?? []) as Row[]).map((row) => {
    const variants = row.product_variants ?? [];
    const sizes = variants.flatMap((v) => v.product_variant_sizes ?? []);
    return {
      id: row.id,
      name: row.name,
      base_sku: row.base_sku,
      colorCount: variants.length,
      skuCount: sizes.length,
      totalStock: sizes.reduce((sum, s) => sum + s.stock, 0),
      linkedProductId: row.products?.[0]?.id,
    };
  });
}

// ---------------------------------------------------------------------------
// Histórico de movimentação de estoque de uma peça — junta inventory_movements
// (já existente, populado pelo trigger record_inventory_movement) com o
// contexto de cor/tamanho. Feito em queries sequenciais (em vez de embed
// profundo de 3 níveis) pelo mesmo motivo do resolveItems em checkout.ts:
// mais simples de ler e não depende de hints de relação do PostgREST.
// ---------------------------------------------------------------------------

export async function getInventoryMovementsForStockItem(stockItemId: string): Promise<InventoryMovement[]> {
  const supabase = createServiceClient();

  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, color_name")
    .eq("stock_item_id", stockItemId);

  const variantIds = (variants ?? []).map((v) => v.id);
  if (variantIds.length === 0) return [];

  const { data: sizes } = await supabase
    .from("product_variant_sizes")
    .select("id, size, variant_id")
    .in("variant_id", variantIds);

  const sizeIds = (sizes ?? []).map((s) => s.id);
  if (sizeIds.length === 0) return [];

  const colorByVariant = new Map((variants ?? []).map((v) => [v.id, v.color_name]));
  const sizeInfoById = new Map(
    (sizes ?? []).map((s) => [s.id, { size: s.size, color: colorByVariant.get(s.variant_id) }])
  );

  const { data: movements, error } = await supabase
    .from("inventory_movements")
    .select("id, product_id, variant_size_id, type, quantity_change, quantity_before, quantity_after, order_id, notes, created_by, created_at")
    .in("variant_size_id", sizeIds)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return (movements ?? []).map((m) => {
    const info = m.variant_size_id ? sizeInfoById.get(m.variant_size_id) : undefined;
    return {
      id:               m.id,
      product_id:       m.product_id,
      variant_size_id:  m.variant_size_id ?? undefined,
      type:             m.type as InventoryMovementType,
      quantity_change:  m.quantity_change,
      quantity_before:  m.quantity_before,
      quantity_after:   m.quantity_after,
      order_id:         m.order_id ?? undefined,
      notes:            m.notes ?? undefined,
      created_by:       m.created_by,
      created_at:       m.created_at,
      color_name:       info?.color,
      size:             info?.size,
    };
  });
}
