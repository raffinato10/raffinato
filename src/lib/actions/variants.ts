"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateVariantSku } from "@/lib/sku";

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

// ---------------------------------------------------------------------------
// Tipos do formulário — uma cor (variante) com suas imagens e tamanhos
// ---------------------------------------------------------------------------

export interface VariantMediaInput {
  dbId?: string;        // product_variant_media.id (se já salvo)
  url: string;
  storagePath?: string;
  is_main: boolean;
  is_hover: boolean;
  display_order: number;
  uploadError?: string;
}

export interface VariantSizeInput {
  dbId?: string;         // product_variant_sizes.id (se já salvo)
  size: string;
  stock: number;
  sku?: string;
  low_stock_alert?: number;
  is_active?: boolean;
}

export interface VariantInput {
  dbId?: string;         // product_variants.id (se já salva)
  color_name: string;
  color_hex: string;
  display_order: number;
  is_active?: boolean;
  media: VariantMediaInput[];
  sizes: VariantSizeInput[];
}

// ---------------------------------------------------------------------------
// saveVariants — substitui todas as variações de um produto/peça pelo estado
// final vindo do formulário. Segue o mesmo padrão defensivo de
// saveMediaChanges (src/lib/actions/media.ts): zera is_main/is_hover antes de
// reaplicar (evita violar os índices únicos transitoriamente), nunca apaga
// arquivo do storage referenciado por outra linha.
// ---------------------------------------------------------------------------

export async function saveVariants(
  productId: string,
  baseSku: string | undefined,
  variants: VariantInput[],
  removedVariantIds: string[]
): Promise<{ error?: string }> {
  let service: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    service = await requireAdmin();
  } catch {
    return { error: "Não autorizado" };
  }

  for (const v of variants) {
    if (!v.color_name.trim()) return { error: "Toda cor precisa de um nome." };
    if (!v.color_hex.trim()) return { error: "Toda cor precisa de um código hexadecimal." };
    const validImages = v.media.filter((m) => !m.uploadError);
    if (validImages.length < 1) {
      return { error: `A cor "${v.color_name}" precisa de pelo menos 1 imagem.` };
    }
    if (v.sizes.length < 1) {
      return { error: `A cor "${v.color_name}" precisa de pelo menos 1 tamanho.` };
    }
    const sizeLabels = v.sizes.map((s) => s.size.trim().toUpperCase());
    if (new Set(sizeLabels).size !== sizeLabels.length) {
      return { error: `A cor "${v.color_name}" tem tamanhos duplicados.` };
    }
  }

  // 1. Excluir variações removidas — limpa storage e deixa o ON DELETE CASCADE
  // cuidar das linhas de mídia/tamanho no banco.
  if (removedVariantIds.length > 0) {
    const { data: mediaToRemove } = await service
      .from("product_variant_media")
      .select("url")
      .in("variant_id", removedVariantIds);

    if (mediaToRemove && mediaToRemove.length > 0) {
      const urls = mediaToRemove.map((m) => m.url);
      const { data: stillUsed } = await service
        .from("product_variant_media")
        .select("url, variant_id")
        .in("url", urls);

      // Produto "tamanho único" espelha a foto principal (product_media) na
      // mídia da variante — as duas linhas apontam pro MESMO arquivo. Sem
      // checar product_media aqui também, apagar a variante apagava o
      // arquivo que a foto principal do produto ainda usava.
      const { data: stillUsedInProductMedia } = await service
        .from("product_media")
        .select("url")
        .in("url", urls);

      const referencedElsewhere = new Set([
        ...(stillUsed ?? [])
          .filter((row) => !removedVariantIds.includes(row.variant_id))
          .map((row) => row.url),
        ...(stillUsedInProductMedia ?? []).map((row) => row.url),
      ]);

      const storagePaths = urls
        .filter((url) => !referencedElsewhere.has(url))
        .map(extractStoragePath)
        .filter((p): p is string => !!p);

      if (storagePaths.length > 0) {
        await service.storage.from(BUCKET).remove(storagePaths);
      }
    }

    const { error: deleteError } = await service
      .from("product_variants")
      .delete()
      .in("id", removedVariantIds);
    if (deleteError) return { error: `Erro ao remover cor: ${deleteError.message}` };
  }

  // 2. Criar/atualizar cada variação mantida
  for (const v of variants) {
    let variantId = v.dbId;

    if (variantId) {
      const { error } = await service
        .from("product_variants")
        .update({
          color_name: v.color_name.trim(),
          color_hex: v.color_hex.trim(),
          display_order: v.display_order,
          is_active: v.is_active ?? true,
        })
        .eq("id", variantId);
      if (error) return { error: `Erro ao atualizar a cor "${v.color_name}": ${error.message}` };
    } else {
      const { data: inserted, error } = await service
        .from("product_variants")
        .insert({
          product_id: productId,
          color_name: v.color_name.trim(),
          color_hex: v.color_hex.trim(),
          display_order: v.display_order,
          is_active: v.is_active ?? true,
        })
        .select("id")
        .single();
      if (error || !inserted) return { error: `Erro ao criar a cor "${v.color_name}": ${error?.message}` };
      variantId = inserted.id;
    }

    // --- Mídia da variação -------------------------------------------------
    const keptMediaIds = v.media.filter((m) => m.dbId).map((m) => m.dbId!);

    const { data: existingMedia } = await service
      .from("product_variant_media")
      .select("id, url")
      .eq("variant_id", variantId);

    const mediaToDelete = (existingMedia ?? []).filter((m) => !keptMediaIds.includes(m.id));
    if (mediaToDelete.length > 0) {
      const idsToDelete = mediaToDelete.map((m) => m.id);
      const urlsToDelete = mediaToDelete.map((m) => m.url);

      const { data: stillUsed } = await service
        .from("product_variant_media")
        .select("url")
        .in("url", urlsToDelete)
        .not("id", "in", `(${idsToDelete.join(",")})`);

      // Mesmo cuidado do bloco de variantes removidas acima — produto
      // "tamanho único" compartilha o arquivo com product_media.
      const { data: stillUsedInProductMedia } = await service
        .from("product_media")
        .select("url")
        .in("url", urlsToDelete);

      const referencedElsewhere = new Set([
        ...(stillUsed ?? []).map((r) => r.url),
        ...(stillUsedInProductMedia ?? []).map((r) => r.url),
      ]);
      const storagePaths = urlsToDelete
        .filter((url) => !referencedElsewhere.has(url))
        .map(extractStoragePath)
        .filter((p): p is string => !!p);

      if (storagePaths.length > 0) {
        await service.storage.from(BUCKET).remove(storagePaths);
      }

      const { error: deleteMediaError } = await service
        .from("product_variant_media")
        .delete()
        .in("id", idsToDelete);
      if (deleteMediaError) return { error: `Erro ao remover imagem: ${deleteMediaError.message}` };
    }

    // Zera is_main/is_hover antes de reaplicar — evita violar os índices
    // únicos parciais transitoriamente, independente da ordem dos updates.
    const { error: clearError } = await service
      .from("product_variant_media")
      .update({ is_main: false, is_hover: false })
      .eq("variant_id", variantId);
    if (clearError) return { error: `Erro ao preparar imagens: ${clearError.message}` };

    const existingMediaItems = v.media.filter((m) => m.dbId);
    for (const m of existingMediaItems) {
      const { error } = await service
        .from("product_variant_media")
        .update({
          is_main: m.is_main,
          is_hover: m.is_hover,
          display_order: m.display_order,
        })
        .eq("id", m.dbId!);
      if (error) return { error: `Erro ao atualizar imagem: ${error.message}` };
    }

    const newMediaItems = v.media.filter((m) => !m.dbId && !m.uploadError);
    if (newMediaItems.length > 0) {
      const { error } = await service.from("product_variant_media").insert(
        newMediaItems.map((m) => ({
          variant_id: variantId,
          url: m.url,
          storage_path: m.storagePath ?? null,
          is_main: m.is_main,
          is_hover: m.is_hover,
          display_order: m.display_order,
        }))
      );
      if (error) return { error: `Erro ao salvar imagem nova: ${error.message}` };
    }

    // --- Tamanhos da variação ------------------------------------------------
    const keptSizeIds = v.sizes.filter((s) => s.dbId).map((s) => s.dbId!);

    const { data: existingSizes } = await service
      .from("product_variant_sizes")
      .select("id")
      .eq("variant_id", variantId);

    const sizeIdsToDelete = (existingSizes ?? [])
      .filter((s) => !keptSizeIds.includes(s.id))
      .map((s) => s.id);
    if (sizeIdsToDelete.length > 0) {
      const { error } = await service
        .from("product_variant_sizes")
        .delete()
        .in("id", sizeIdsToDelete);
      if (error) return { error: `Erro ao remover tamanho: ${error.message}` };
    }

    for (const s of v.sizes.filter((s) => s.dbId)) {
      const sku = s.sku?.trim() || generateVariantSku(baseSku ?? "SKU", v.color_name, s.size);
      const { error } = await service
        .from("product_variant_sizes")
        .update({
          size: s.size.trim(),
          stock: s.stock,
          sku,
          low_stock_alert: s.low_stock_alert ?? 5,
          is_active: s.is_active ?? true,
        })
        .eq("id", s.dbId!);
      if (error) return { error: `Erro ao atualizar tamanho "${s.size}": ${error.message}` };
    }

    const newSizes = v.sizes.filter((s) => !s.dbId);
    if (newSizes.length > 0) {
      const { error } = await service.from("product_variant_sizes").insert(
        newSizes.map((s) => ({
          variant_id: variantId,
          size: s.size.trim(),
          stock: s.stock,
          sku: s.sku?.trim() || generateVariantSku(baseSku ?? "SKU", v.color_name, s.size),
          low_stock_alert: s.low_stock_alert ?? 5,
          is_active: s.is_active ?? true,
        }))
      );
      if (error) return { error: `Erro ao salvar tamanho novo: ${error.message}` };
    }
  }

  revalidatePath(`/admin/produtos/${productId}/editar`);
  revalidatePath("/admin/produtos");
  revalidatePath("/produtos/[slug]", "page");
  revalidatePath("/categoria/[slug]", "page");
  revalidatePath("/");

  return {};
}
