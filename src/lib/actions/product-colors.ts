"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { ProductColor } from "@/types";

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
// Curadoria de cores de um produto vinculado a uma peça do estoque — escolhe
// quais cores da peça aparecem, em que ordem, qual é a principal, e curadoria
// de imagens por cor (cópia do estoque + ajustes próprios do produto). Nunca
// duplica tamanho/SKU/quantidade, que continuam vivos em
// product_variant_sizes via variant_id.
// ---------------------------------------------------------------------------

export interface ProductColorImageInput {
  dbId?: string;          // product_color_images.id (se já salva)
  url: string;
  storagePath?: string;   // só relevante quando source = "upload"
  source: "stock" | "upload";
  stockMediaId?: string;  // proveniência — product_variant_media.id de origem, se source = "stock"
  is_primary: boolean;
  is_hover: boolean;
  display_order: number;
}

export interface ProductColorInput {
  dbId?: string;          // product_colors.id (se já salva)
  variantId: string;      // product_variants.id da cor, dentro da peça vinculada
  display_order: number;
  is_main: boolean;
  images: ProductColorImageInput[];
}

export async function saveProductColors(
  productId: string,
  stockItemId: string,
  colors: ProductColorInput[],
  removedColorIds: string[]
): Promise<{ error?: string }> {
  let service: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    service = await requireAdmin();
  } catch {
    return { error: "Não autorizado" };
  }

  if (colors.length < 1) {
    return { error: "Selecione pelo menos uma cor da peça vinculada." };
  }
  const variantIds = colors.map((c) => c.variantId);
  if (new Set(variantIds).size !== variantIds.length) {
    return { error: "A mesma cor foi adicionada duas vezes." };
  }
  if (colors.filter((c) => c.is_main).length !== 1) {
    return { error: "Escolha exatamente uma cor principal." };
  }

  // Nunca confiar no cliente: toda cor selecionada precisa pertencer
  // realmente à peça vinculada a este produto.
  const { data: ownedVariants, error: ownedError } = await service
    .from("product_variants")
    .select("id")
    .eq("stock_item_id", stockItemId)
    .in("id", variantIds);
  if (ownedError) return { error: `Erro ao validar cores: ${ownedError.message}` };
  const ownedIds = new Set((ownedVariants ?? []).map((v) => v.id));
  if (variantIds.some((id) => !ownedIds.has(id))) {
    return { error: "Uma das cores selecionadas não pertence à peça vinculada a este produto." };
  }

  // 1. Excluir cores removidas — limpa storage de imagens 'upload' órfãs e
  // deixa o ON DELETE CASCADE cuidar das linhas de product_color_images.
  if (removedColorIds.length > 0) {
    const cleanupError = await cleanupColorImages(service, removedColorIds);
    if (cleanupError) return { error: cleanupError };

    const { error: deleteError } = await service
      .from("product_colors")
      .delete()
      .in("id", removedColorIds);
    if (deleteError) return { error: `Erro ao remover cor: ${deleteError.message}` };
  }

  // 2. Zera is_main de todas as cores já salvas deste produto antes de
  // reaplicar — evita violar o índice único parcial (1 principal por
  // produto) transitoriamente, independente da ordem dos updates.
  const { error: clearMainError } = await service
    .from("product_colors")
    .update({ is_main: false })
    .eq("product_id", productId);
  if (clearMainError) return { error: `Erro ao preparar cores: ${clearMainError.message}` };

  // 3. Criar/atualizar cada cor mantida
  for (const c of colors) {
    let colorId = c.dbId;

    if (colorId) {
      const { error } = await service
        .from("product_colors")
        .update({ variant_id: c.variantId, display_order: c.display_order, is_main: c.is_main })
        .eq("id", colorId);
      if (error) return { error: `Erro ao atualizar cor: ${error.message}` };
    } else {
      const { data: inserted, error } = await service
        .from("product_colors")
        .insert({
          product_id: productId,
          variant_id: c.variantId,
          display_order: c.display_order,
          is_main: c.is_main,
        })
        .select("id")
        .single();
      if (error || !inserted) return { error: `Erro ao adicionar cor: ${error?.message}` };
      colorId = inserted.id;
    }

    const imagesError = await saveColorImages(service, colorId, c.images);
    if (imagesError) return { error: imagesError };
  }

  revalidatePath(`/admin/produtos/${productId}/editar`);
  revalidatePath("/admin/produtos");
  revalidatePath("/produtos/[slug]", "page");
  revalidatePath("/categoria/[slug]", "page");
  revalidatePath("/");

  return {};
}

// ---------------------------------------------------------------------------
// getProductColors — curadoria já salva de um produto, no formato bruto
// (com dbIds) que o formulário de edição usa para inicializar o
// ProductColorCurator. Diferente de attachStockItemVariants (que devolve o
// formato ProductVariant já remodelado para a loja pública/preview).
// ---------------------------------------------------------------------------

export async function getProductColors(
  productId: string
): Promise<ProductColor[] | { error: string }> {
  let service: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    service = await requireAdmin();
  } catch {
    return { error: "Não autorizado" };
  }

  const { data, error } = await service
    .from("product_colors")
    .select(`
      id, product_id, variant_id, display_order, is_main, created_at, updated_at,
      product_color_images ( id, product_color_id, url, storage_path, source, stock_media_id, is_primary, is_hover, display_order, created_at )
    `)
    .eq("product_id", productId)
    .order("display_order", { ascending: true });

  if (error) return { error: error.message };

  return (data ?? []).map((row) => ({
    id: row.id,
    product_id: row.product_id,
    variant_id: row.variant_id,
    display_order: row.display_order,
    is_main: row.is_main,
    created_at: row.created_at,
    updated_at: row.updated_at,
    images: (row.product_color_images ?? [])
      .slice()
      .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
      .map((img: {
        id: string; product_color_id: string; url: string; storage_path: string | null;
        source: string; stock_media_id: string | null; is_primary: boolean; is_hover: boolean;
        display_order: number; created_at: string;
      }) => ({
        id: img.id,
        product_color_id: img.product_color_id,
        url: img.url,
        storage_path: img.storage_path ?? undefined,
        source: img.source as "stock" | "upload",
        stock_media_id: img.stock_media_id ?? undefined,
        is_primary: img.is_primary,
        is_hover: img.is_hover,
        display_order: img.display_order,
        created_at: img.created_at,
      })),
  }));
}

// ---------------------------------------------------------------------------
// clearProductColors — apaga toda a curadoria de um produto. Usado quando o
// admin desvincula a peça (volta para "Manual") ou troca para uma peça
// diferente — sem isso, a curadoria antiga ficaria referenciando variantes
// de uma peça que o produto não usa mais.
// ---------------------------------------------------------------------------

export async function clearProductColors(productId: string): Promise<{ error?: string }> {
  let service: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    service = await requireAdmin();
  } catch {
    return { error: "Não autorizado" };
  }

  const { data: existing } = await service
    .from("product_colors")
    .select("id")
    .eq("product_id", productId);
  const colorIds = (existing ?? []).map((c) => c.id);
  if (colorIds.length === 0) return {};

  const cleanupError = await cleanupColorImages(service, colorIds);
  if (cleanupError) return { error: cleanupError };

  const { error } = await service.from("product_colors").delete().in("id", colorIds);
  if (error) return { error: `Erro ao limpar cores antigas: ${error.message}` };

  return {};
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = any;

// Apaga do Storage os arquivos de imagens source='upload' que pertencem só
// a estas cores (nunca apaga imagens source='stock' — o produto não é dono
// desse arquivo, ele pertence ao Estoque).
async function cleanupColorImages(service: ServiceClient, colorIds: string[]): Promise<string | undefined> {
  const { data: images } = await service
    .from("product_color_images")
    .select("url, source")
    .in("product_color_id", colorIds);

  const uploadUrls: string[] = (images ?? [])
    .filter((i: { source: string }) => i.source === "upload")
    .map((i: { url: string }) => i.url);
  if (uploadUrls.length === 0) return undefined;

  const { data: stillUsed } = await service
    .from("product_color_images")
    .select("url, product_color_id")
    .in("url", uploadUrls);

  const referencedElsewhere = new Set<string>(
    (stillUsed ?? [])
      .filter((row: { product_color_id: string }) => !colorIds.includes(row.product_color_id))
      .map((row: { url: string }) => row.url)
  );

  const storagePaths = uploadUrls
    .filter((url: string) => !referencedElsewhere.has(url))
    .map(extractStoragePath)
    .filter((p): p is string => !!p);

  if (storagePaths.length > 0) {
    await service.storage.from(BUCKET).remove(storagePaths);
  }
  return undefined;
}

async function saveColorImages(
  service: ServiceClient,
  colorId: string,
  images: ProductColorImageInput[]
): Promise<string | undefined> {
  const keptIds = images.filter((m) => m.dbId).map((m) => m.dbId!);

  const { data: existingImages } = await service
    .from("product_color_images")
    .select("id, url, source")
    .eq("product_color_id", colorId);

  const toDelete = (existingImages ?? []).filter((m: { id: string }) => !keptIds.includes(m.id));
  if (toDelete.length > 0) {
    const idsToDelete: string[] = toDelete.map((m: { id: string }) => m.id);
    const uploadUrls: string[] = toDelete
      .filter((m: { source: string }) => m.source === "upload")
      .map((m: { url: string }) => m.url);

    if (uploadUrls.length > 0) {
      const { data: stillUsed } = await service
        .from("product_color_images")
        .select("url")
        .in("url", uploadUrls)
        .not("id", "in", `(${idsToDelete.join(",")})`);
      const referencedElsewhere = new Set<string>((stillUsed ?? []).map((r: { url: string }) => r.url));
      const storagePaths = uploadUrls
        .filter((url: string) => !referencedElsewhere.has(url))
        .map(extractStoragePath)
        .filter((p): p is string => !!p);
      if (storagePaths.length > 0) {
        await service.storage.from(BUCKET).remove(storagePaths);
      }
    }

    const { error } = await service.from("product_color_images").delete().in("id", idsToDelete);
    if (error) return `Erro ao remover imagem: ${error.message}`;
  }

  // Zera is_primary/is_hover antes de reaplicar — evita violar os índices
  // únicos parciais transitoriamente, independente da ordem dos updates.
  const { error: clearError } = await service
    .from("product_color_images")
    .update({ is_primary: false, is_hover: false })
    .eq("product_color_id", colorId);
  if (clearError) return `Erro ao preparar imagens: ${clearError.message}`;

  for (const img of images.filter((m) => m.dbId)) {
    const { error } = await service
      .from("product_color_images")
      .update({ is_primary: img.is_primary, is_hover: img.is_hover, display_order: img.display_order })
      .eq("id", img.dbId!);
    if (error) return `Erro ao atualizar imagem: ${error.message}`;
  }

  const newImages = images.filter((m) => !m.dbId);
  if (newImages.length > 0) {
    const { error } = await service.from("product_color_images").insert(
      newImages.map((m) => ({
        product_color_id: colorId,
        url: m.url,
        storage_path: m.storagePath ?? null,
        source: m.source,
        stock_media_id: m.stockMediaId ?? null,
        is_primary: m.is_primary,
        is_hover: m.is_hover,
        display_order: m.display_order,
      }))
    );
    if (error) return `Erro ao salvar imagem nova: ${error.message}`;
  }

  return undefined;
}
