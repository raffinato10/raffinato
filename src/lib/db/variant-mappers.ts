// Mapeamento compartilhado de cor/imagem/tamanho — usado tanto por produtos
// (src/lib/db/products.ts, público) quanto pelo admin (src/lib/db/admin.ts),
// evitando manter cópias da mesma lógica.

import type { ProductVariant, ProductVariantMedia, ProductVariantSize } from "@/types";
import type { DbProductVariant, DbProductVariantMedia, DbProductVariantSize } from "@/types/database.types";

const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "XXG"];

export function sortSizes(sizes: ProductVariantSize[]): ProductVariantSize[] {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.size.toUpperCase());
    const ib = SIZE_ORDER.indexOf(b.size.toUpperCase());
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function toVariantMedia(row: DbProductVariantMedia): ProductVariantMedia {
  return {
    id:            row.id,
    variant_id:    row.variant_id,
    url:           row.url,
    storage_path:  row.storage_path ?? undefined,
    is_main:       row.is_main,
    is_hover:      row.is_hover,
    display_order: row.display_order,
    created_at:    row.created_at,
  };
}

export function toVariantSize(row: DbProductVariantSize): ProductVariantSize {
  return {
    id:              row.id,
    variant_id:      row.variant_id,
    size:            row.size,
    stock:           row.stock,
    sku:             row.sku ?? undefined,
    low_stock_alert: row.low_stock_alert,
    is_active:       row.is_active,
    created_at:      row.created_at,
    updated_at:      row.updated_at,
  };
}

export type VariantRowWithRelations = DbProductVariant & {
  product_variant_media?: DbProductVariantMedia[];
  product_variant_sizes?: DbProductVariantSize[];
};

export function toVariant(row: VariantRowWithRelations): ProductVariant {
  return {
    id:            row.id,
    product_id:    row.product_id,
    color_name:    row.color_name,
    color_hex:     row.color_hex,
    display_order: row.display_order,
    is_active:     row.is_active,
    created_at:    row.created_at,
    updated_at:    row.updated_at,
    media: (row.product_variant_media ?? [])
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map(toVariantMedia),
    sizes: sortSizes((row.product_variant_sizes ?? []).map(toVariantSize)),
  };
}

// Campos completos de uma variante (cor) + suas imagens e tamanhos — usado
// no embed `product_variants ( ${VARIANT_FIELDS} )` dentro de uma query de
// produtos.
export const VARIANT_FIELDS = `
  id, product_id, color_name, color_hex, display_order, is_active, created_at, updated_at,
  product_variant_media ( id, variant_id, url, storage_path, is_main, is_hover, display_order, created_at ),
  product_variant_sizes ( id, variant_id, size, stock, sku, low_stock_alert, is_active, created_at, updated_at )
` as const;
