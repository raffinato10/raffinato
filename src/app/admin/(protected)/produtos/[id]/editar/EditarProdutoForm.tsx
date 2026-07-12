"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft, Trash2, Info, EyeOff, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { Toggle } from "@/components/common/Toggle";
import { Modal } from "@/components/common/Modal";
import { MediaUploader } from "@/components/admin/MediaUploader";
import { ProductPreviewCard } from "@/components/admin/ProductPreviewCard";
import { PriceTierEditor } from "@/components/admin/PriceTierEditor";
import { ProductBadgeEditor } from "@/components/admin/ProductBadgeEditor";
import { VariantEditor } from "@/components/admin/VariantEditor";
import { ProductSizeEditor } from "@/components/admin/ProductSizeEditor";
import { StockItemLinkPicker } from "@/components/admin/StockItemLinkPicker";
import { ProductColorCurator } from "@/components/admin/ProductColorCurator";
import { updateProduct, deleteProduct } from "@/lib/actions/products";
import { saveMediaChanges } from "@/lib/actions/media";
import { saveVariants } from "@/lib/actions/variants";
import { saveProductColors, clearProductColors, getProductColors } from "@/lib/actions/product-colors";
import { getStockItemForLinkPreview } from "@/lib/actions/stock-items";
import { routes } from "@/lib/routes";
import { slugify } from "@/lib/formatters";
import type { ProductFormData } from "@/lib/actions/products";
import type { AdminProduct } from "@/lib/db/admin";
import type { UploadedMedia } from "@/components/admin/MediaUploader";
import type { ProductBadgeValue } from "@/components/admin/ProductBadgeEditor";
import type { VariantInput } from "@/lib/actions/variants";
import type { SimpleSizeInput } from "@/components/admin/ProductSizeEditor";
import type { ProductColorInput } from "@/lib/actions/product-colors";
import type { PriceTier, ProductSpecification, ProductMedia, ProductAvailability, Product, StockItem, ProductColor } from "@/types";

const SPEC_LABELS = ["Tecido", "Tamanhos disponíveis", "Modelagem", "Cuidados de lavagem"] as const;

function specsToFields(specs: ProductSpecification[] | undefined) {
  const map = new Map((specs ?? []).map((s) => [s.label, s.value]));
  return SPEC_LABELS.map((label) => map.get(label) ?? "");
}

interface CategoryOption {
  value: string;
  label: string;
}

interface CategoryTreeOption extends CategoryOption {
  children: CategoryOption[];
}

// Acha o departamento (categoria de topo) ao qual uma categoria-folha
// pertence — usada para pré-selecionar o 1º select a partir do category_id
// já salvo no produto.
function findDepartmentId(tree: CategoryTreeOption[], categoryId: string): string {
  if (!categoryId) return "";
  const direct = tree.find((d) => d.value === categoryId);
  if (direct) return direct.value; // departamento sem subcategorias, usado como folha
  const parent = tree.find((d) => d.children.some((c) => c.value === categoryId));
  return parent?.value ?? "";
}

interface Props {
  product: AdminProduct;
  categoryTree: CategoryTreeOption[];
}

function HelpText({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-1.5 mt-1">
      <Info size={12} className="text-muted flex-shrink-0 mt-0.5" />
      <p className="text-xs text-muted">{text}</p>
    </div>
  );
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-dark-text">{title}</h2>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function EditarProdutoForm({ product, categoryTree }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [mediaItems, setMediaItems] = useState<UploadedMedia[]>([]);
  const [removedDbIds, setRemovedDbIds] = useState<string[]>([]);

  const handleMediaChange = (items: UploadedMedia[], removed: string[]) => {
    setMediaItems(items);
    setRemovedDbIds(removed);
  };

  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [sku, setSku] = useState(product.sku);
  const [categoryId, setCategoryId] = useState(product.category_id);
  const [departmentId, setDepartmentId] = useState(
    findDepartmentId(categoryTree, product.category_id)
  );
  const [isActive, setIsActive] = useState(product.is_active);
  const [isFeatured, setIsFeatured] = useState(product.is_featured);
  const [shortDesc, setShortDesc] = useState(product.short_description);
  const [description, setDescription] = useState(product.description);
  const [benefits, setBenefits] = useState(product.benefits ?? "");
  const [warnings, setWarnings] = useState(product.warnings ?? "");
  const [pricePix, setPricePix] = useState(product.price_pix.toString());
  const [priceCard, setPriceCard] = useState(product.price_card.toString());
  const [pricePromo, setPricePromo] = useState(
    product.price_promotional?.toString() ?? ""
  );
  const [promotionalActive, setPromotionalActive] = useState(
    product.promotional_active
  );
  const [trackStock, setTrackStock] = useState(product.track_stock);
  const [stock, setStock] = useState(product.stock?.toString() ?? "");
  const [stockMin, setStockMin] = useState(product.stock_minimum.toString());
  const [quantityPricingEnabled, setQuantityPricingEnabled] = useState(
    product.quantity_pricing_enabled
  );
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>(product.price_tiers ?? []);
  const initialSpecs = specsToFields(product.specifications);
  const [specComposicao, setSpecComposicao] = useState(initialSpecs[0]);
  const [specVolume, setSpecVolume] = useState(initialSpecs[1]);
  const [specAplicacoes, setSpecAplicacoes] = useState(initialSpecs[2]);
  const [specConservacao, setSpecConservacao] = useState(initialSpecs[3]);
  const [weight, setWeight] = useState(product.weight_kg.toString());
  const [height, setHeight] = useState(product.height_cm.toString());
  const [width, setWidth] = useState(product.width_cm.toString());
  const [length, setLength] = useState(product.length_cm.toString());
  const [handlingDays, setHandlingDays] = useState(
    product.extra_handling_days.toString()
  );
  const [allowWhatsapp, setAllowWhatsapp] = useState(product.allow_whatsapp);
  const [variants, setVariants] = useState<VariantInput[]>([]);
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);

  // Manual: "Tamanho único" (sem cor) ou "Várias cores" — produto com 0 ou 1
  // variante já cadastrada abre no modo simples; com 2+ cores, abre no
  // editor avançado. A variante única existente (se houver) é preservada
  // pra não duplicar nada ao salvar.
  const existingSingleVariant = (product.variants?.length ?? 0) <= 1 ? product.variants?.[0] : undefined;
  const [colorMode, setColorMode] = useState<"single" | "multi">(
    (product.variants?.length ?? 0) > 1 ? "multi" : "single"
  );
  const [simpleSizes, setSimpleSizes] = useState<SimpleSizeInput[]>([]);

  // Origem do produto: manual ou vinculado a uma peça do estoque. Se já
  // vinculado, sintetiza um StockItem a partir do que já vem em `product`
  // (já resolvido server-side via attachStockItemVariants) — assim
  // hasVariants fica correto imediatamente, sem esperar nenhum fetch. O
  // fetch abaixo só corrige o nome de exibição da peça.
  const [origin, setOrigin] = useState<"manual" | "linked">(product.stock_item_id ? "linked" : "manual");
  const [linkedStockItem, setLinkedStockItem] = useState<StockItem | null>(() =>
    product.stock_item_id
      ? {
          id: product.stock_item_id,
          name: "Peça do estoque",
          base_sku: product.sku,
          is_active: true,
          variants: product.variants ?? [],
          created_at: product.created_at,
          updated_at: product.updated_at,
        }
      : null
  );

  useEffect(() => {
    if (!product.stock_item_id) return;
    getStockItemForLinkPreview(product.stock_item_id).then((item) => {
      if (item && !("error" in item)) setLinkedStockItem(item);
    });
  }, [product.stock_item_id]);

  // Curadoria de cores já salva (product_colors) — formato bruto com dbIds,
  // diferente de product.variants (que já vem remodelado pra loja pública).
  // Só existe pra carregar quando o produto JÁ estava vinculado a esta
  // mesma peça; se o admin trocar de peça, o ProductColorCurator é
  // remontado (key=linkedStockItem.id) e parte de uma seleção nova, vazia.
  const originalStockItemId = product.stock_item_id ?? null;
  const [initialColors, setInitialColors] = useState<ProductColor[]>([]);
  const [colorsLoading, setColorsLoading] = useState(!!originalStockItemId);
  const [colors, setColors] = useState<ProductColorInput[]>([]);
  const [removedColorIds, setRemovedColorIds] = useState<string[]>([]);

  // Refaz a busca após cada save bem-sucedido (product.updated_at muda) —
  // mesmo motivo do key=product.updated_at no MediaUploader/VariantEditor:
  // sem isso, o curator nunca aprenderia os dbIds das cores recém-criadas e
  // duplicaria tudo a cada novo clique em "Salvar".
  useEffect(() => {
    if (!originalStockItemId) return;
    setColorsLoading(true);
    getProductColors(product.id).then((result) => {
      if (!("error" in result)) setInitialColors(result);
      setColorsLoading(false);
    });
  }, [product.id, product.updated_at, originalStockItemId]);

  const manualSizes = colorMode === "single" ? simpleSizes : variants.flatMap((v) => v.sizes);
  const hasVariants =
    origin === "linked" ? (linkedStockItem?.variants.length ?? 0) > 0 : manualSizes.length > 0;
  const manualStockTotal = manualSizes.reduce((sum, s) => sum + (Number(s.stock) || 0), 0);

  const [badge, setBadge] = useState<ProductBadgeValue | null>(
    product.badge_image_url
      ? {
          url:         product.badge_image_url,
          storagePath: product.badge_storage_path ?? "",
          posX:        product.badge_position_x ?? 50,
          posY:        product.badge_position_y ?? 50,
          widthPct:    product.badge_width_pct  ?? 25,
        }
      : null
  );

  const selectedDepartment = categoryTree.find((d) => d.value === departmentId);
  const subcategoryOptions = selectedDepartment?.children ?? [];
  const hasSubcategories = subcategoryOptions.length > 0;
  const selectedCat = hasSubcategories
    ? subcategoryOptions.find((c) => c.value === categoryId)
    : selectedDepartment;

  const handleDepartmentChange = (id: string) => {
    setDepartmentId(id);
    const dept = categoryTree.find((d) => d.value === id);
    setCategoryId(dept && dept.children.length === 0 ? id : "");
  };

  // ---------------------------------------------------------------------------
  // Detecção de alterações não salvas — compara o estado atual do formulário
  // com um snapshot do que está realmente salvo no banco (capturado uma única
  // vez, a partir de `product`, e atualizado após cada save bem-sucedido).
  // Usado para avisar o admin antes de sair da página com edições pendentes.
  // ---------------------------------------------------------------------------
  const initialSnapshotRef = useRef(
    JSON.stringify({
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      categoryId: product.category_id,
      isActive: product.is_active,
      isFeatured: product.is_featured,
      shortDesc: product.short_description,
      description: product.description,
      benefits: product.benefits ?? "",
      warnings: product.warnings ?? "",
      pricePix: product.price_pix.toString(),
      priceCard: product.price_card.toString(),
      pricePromo: product.price_promotional?.toString() ?? "",
      promotionalActive: product.promotional_active,
      trackStock: product.track_stock,
      stock: product.stock?.toString() ?? "",
      stockMin: product.stock_minimum.toString(),
      quantityPricingEnabled: product.quantity_pricing_enabled,
      priceTiers: product.price_tiers ?? [],
      specs: initialSpecs,
      weight: product.weight_kg.toString(),
      height: product.height_cm.toString(),
      width: product.width_cm.toString(),
      length: product.length_cm.toString(),
      handlingDays: product.extra_handling_days.toString(),
      allowWhatsapp: product.allow_whatsapp,
      badge,
      media: (product.media ?? [])
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map((m) => ({ url: m.url, type: m.type, alt_text: m.alt_text ?? "" })),
      // Mesma forma normalizada usada no currentSnapshot abaixo — os dois
      // lados partem de tipos diferentes (ProductVariant[] vs VariantInput[])
      // e comparar os objetos crus dispararia "alterações não salvas" mesmo
      // sem nenhuma edição, igual ao cuidado já tomado com `media` acima.
      // Vinculado a uma peça, a seção "Cores e tamanhos" nem aparece (edita-se
      // em Estoque) — por isso fica fora da comparação nesse modo.
      origin: product.stock_item_id ? "linked" : "manual",
      linkedStockItemId: product.stock_item_id ?? null,
      // Forma comparável com o currentSnapshot abaixo: "tamanho único" só
      // compara os tamanhos (sem cor/mídia, que aqui são sempre a peça
      // neutra), "várias cores" mantém a forma completa de sempre.
      variants: product.stock_item_id
        ? []
        : (product.variants?.length ?? 0) > 1
        ? (product.variants ?? []).map((v) => ({
            color_name: v.color_name,
            color_hex: v.color_hex,
            media: v.media.map((m) => ({ url: m.url, is_main: m.is_main, is_hover: m.is_hover })),
            sizes: v.sizes.map((s) => ({ size: s.size, stock: s.stock })),
          }))
        : (product.variants?.[0]?.sizes ?? []).map((s) => ({ size: s.size, stock: s.stock })),
    })
  );

  const currentSnapshot = JSON.stringify({
    name, slug, sku, categoryId, isActive, isFeatured, shortDesc, description,
    benefits, warnings, pricePix, priceCard, pricePromo, promotionalActive,
    trackStock, stock, stockMin, quantityPricingEnabled, priceTiers,
    origin, linkedStockItemId: linkedStockItem?.id ?? null,
    specs: [specComposicao, specVolume, specAplicacoes, specConservacao],
    weight, height, width, length, handlingDays, allowWhatsapp, badge,
    media: mediaItems
      .filter((m) => !m.uploading && !m.uploadError)
      .map((m) => ({ url: m.url, type: m.type, alt_text: m.alt_text ?? "" })),
    variants: colorMode === "single"
      ? simpleSizes.map((s) => ({ size: s.size, stock: s.stock }))
      : variants.map((v) => ({
          color_name: v.color_name,
          color_hex: v.color_hex,
          media: v.media.filter((m) => !m.uploadError).map((m) => ({ url: m.url, is_main: m.is_main, is_hover: m.is_hover })),
          sizes: v.sizes.map((s) => ({ size: s.size, stock: s.stock })),
        })),
  });

  const isDirty = currentSnapshot !== initialSnapshotRef.current;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Fechar a aba, atualizar a página ou digitar outra URL com edições pendentes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Navegar para qualquer outro link da página (voltar, menu lateral, topo)
  // com edições pendentes — intercepta no capture phase, antes do Next.js
  // processar a navegação client-side do <Link>, e abre o modal de
  // confirmação em vez do diálogo nativo do navegador.
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null);

  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      if (!isDirtyRef.current) return;
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor || anchor.target === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      e.preventDefault();
      e.stopPropagation();
      setPendingNavHref(href);
    };
    document.addEventListener("click", handleLinkClick, true);
    return () => document.removeEventListener("click", handleLinkClick, true);
  }, []);

  // Vinculado, o preview usa as imagens da cor principal escolhida na
  // curadoria — não o uploader "Foto principal" (que nesse modo é só capa
  // de reserva). Sem cor principal ainda, cai no uploader normal.
  const mainColorImages = colors.find((c) => c.is_main)?.images;
  const previewMedia =
    origin === "linked" && mainColorImages && mainColorImages.length > 0
      ? mainColorImages.slice().sort((a, b) => a.display_order - b.display_order).map((img) => ({ url: img.url, type: "image" as const }))
      : mediaItems.filter((m) => !m.uploading && !m.uploadError).map((m) => ({ url: m.url, type: m.type }));

  // Vinculado a uma peça, os tamanhos já são conhecidos (vêm do estoque) —
  // não faz sentido pedir pro admin digitar de novo algo que já existe.
  const linkedSizesLabel =
    origin === "linked" && linkedStockItem
      ? Array.from(new Set(linkedStockItem.variants.flatMap((v) => v.sizes.map((s) => s.size)))).join(", ")
      : "";
  const effectiveSpecVolume = origin === "linked" ? linkedSizesLabel : specVolume;

  const specifications: ProductSpecification[] = SPEC_LABELS.map((label, i) => ({
    label,
    value: [specComposicao, effectiveSpecVolume, specAplicacoes, specConservacao][i],
  }));

  // Produto "ao vivo" a partir do estado atual do formulário, SEM os campos
  // de badge — usado apenas para a renderização de contexto do
  // ProductBadgeEditor (o selo em si é desenhado por cima, arrastável).
  const stockNum = parseInt(stock) || 0;
  const stockMinNum = parseInt(stockMin) || 2;
  const previewAvailability: ProductAvailability = !trackStock
    ? "in_stock"
    : stockNum <= 0
    ? "out_of_stock"
    : stockNum <= stockMinNum
    ? "low_stock"
    : "in_stock";

  const badgePreviewMedia: ProductMedia[] = mediaItems
    .filter((m) => !m.uploading && !m.uploadError)
    .map((m, i) => ({
      id:            m.dbId ?? m.localId,
      product_id:    product.id,
      type:          m.type,
      url:           m.url,
      alt_text:      m.alt_text,
      display_order: i,
      is_main:       i === 0,
      created_at:    product.created_at,
    }));

  const badgePreviewProduct: Product = {
    id:                  product.id,
    name:                name || "Nome do produto",
    slug:                slug || "produto",
    sku:                 sku || "SKU-000",
    category_id:         categoryId,
    display_order:       product.display_order,
    price_pix:           parseFloat(pricePix)  || 0,
    price_card:          parseFloat(priceCard) || 0,
    price_promotional:   parseFloat(pricePromo) || undefined,
    promotional_active:  promotionalActive,
    is_active:           isActive,
    is_featured:         isFeatured,
    short_description:   shortDesc,
    description,
    specifications,
    media:               badgePreviewMedia,
    stock:               hasVariants ? null : (trackStock ? stockNum : null),
    stock_minimum:       stockMinNum,
    availability:        previewAvailability,
    track_stock:         hasVariants ? false : trackStock,
    quantity_pricing_enabled: quantityPricingEnabled,
    price_tiers:         priceTiers,
    weight_kg:           parseFloat(weight) || 0.1,
    height_cm:           parseFloat(height) || 10,
    width_cm:            parseFloat(width)  || 10,
    length_cm:           parseFloat(length) || 10,
    extra_handling_days: parseInt(handlingDays) || 0,
    allow_whatsapp:      allowWhatsapp,
    created_at:          product.created_at,
    updated_at:          product.updated_at,
  };

  const buildPayload = (): ProductFormData => ({
    name,
    slug,
    sku: origin === "linked" ? (linkedStockItem?.base_sku ?? sku) : sku,
    stock_item_id:       origin === "linked" ? (linkedStockItem?.id ?? null) : null,
    category_id:         categoryId,
    price_pix:           parseFloat(pricePix)  || 0,
    price_card:          parseFloat(priceCard) || 0,
    price_promotional:   parseFloat(pricePromo) || null,
    promotional_active:  promotionalActive,
    is_active:           isActive,
    is_featured:         isFeatured,
    short_description:   shortDesc,
    description,
    benefits:            benefits  || undefined,
    warnings:            warnings  || undefined,
    specifications,
    stock:               hasVariants ? null : (trackStock ? (parseInt(stock) || 0) : null),
    stock_minimum:       parseInt(stockMin)    || 2,
    track_stock:         hasVariants ? false : trackStock,
    quantity_pricing_enabled: quantityPricingEnabled,
    price_tiers:         priceTiers,
    weight_kg:           parseFloat(weight)    || 0.1,
    height_cm:           parseFloat(height)    || 10,
    width_cm:            parseFloat(width)     || 10,
    length_cm:           parseFloat(length)    || 10,
    extra_handling_days: parseInt(handlingDays) || 0,
    allow_whatsapp:      allowWhatsapp,
    badge_image_url:     badge?.url         ?? null,
    badge_storage_path:  badge?.storagePath ?? null,
    badge_position_x:    badge?.posX,
    badge_position_y:    badge?.posY,
    badge_width_pct:     badge?.widthPct,
  });

  const handleSave = () => {
    setError(null);
    setSaved(false);

    if (origin === "linked" && !linkedStockItem) {
      setError("Selecione uma peça do estoque para vincular, ou troque para \"Manual\".");
      return;
    }
    if (origin === "linked" && colorsLoading) {
      setError("Aguarde o carregamento das cores antes de salvar.");
      return;
    }
    if (origin === "linked" && isActive && colors.length < 1) {
      setError("Adicione pelo menos uma cor da peça vinculada, ou desative o produto.");
      return;
    }

    // "Tamanho único" usa a "Foto principal" como imagem da variante única —
    // por isso sempre exige foto nesse modo, igual ao produto sem variação.
    const imageCount = mediaItems.filter((m) => m.type === "image" && !m.uploadError).length;
    const needsTopImage = origin === "manual" && (colorMode === "single" || !hasVariants);
    if (needsTopImage && imageCount < 1) {
      setError("Adicione pelo menos 1 imagem do produto.");
      return;
    }

    // A peça vinculada mudou (ou o produto saiu do modo vinculado) — a
    // curadoria antiga (product_colors) referencia variantes de uma peça
    // que este produto não usa mais e precisa ser totalmente substituída,
    // não só incrementalmente ajustada.
    const newStockItemId = origin === "linked" ? linkedStockItem?.id ?? null : null;
    const stockItemChanged = newStockItemId !== originalStockItemId;

    startTransition(async () => {
      const result = await updateProduct(product.id, buildPayload());
      if (result.error) { setError(result.error); return; }

      const mediaResult = await saveMediaChanges(product.id, mediaItems, removedDbIds);
      if (mediaResult.error) { setError(mediaResult.error); return; }

      // Vinculado a uma peça, as variações já existem em Estoque — não há
      // nada pra salvar aqui. "Tamanho único" monta 1 variante com cor
      // neutra (nunca exibida) usando as fotos da "Foto principal" — sem
      // isso, a galeria da PDP ficaria vazia (ela usa a mídia da variante,
      // não a do produto, quando há variação). Preserva o dbId da variante
      // única existente pra não duplicar a cada save.
      if (origin === "manual") {
        const variantsToSave: VariantInput[] =
          colorMode === "single"
            ? simpleSizes.length > 0
              ? [{
                  dbId: existingSingleVariant?.id,
                  color_name: existingSingleVariant?.color_name || "Padrão",
                  color_hex: existingSingleVariant?.color_hex || "#000000",
                  display_order: 0,
                  is_active: true,
                  // Casa pela URL com a mídia da variante já salva, pra
                  // preservar o dbId — sem isso, TODA imagem era tratada
                  // como nova a cada save, apagando e recriando a mesma
                  // linha (e, por compartilhar o arquivo com a foto
                  // principal, arriscando apagar o arquivo físico também).
                  media: mediaItems
                    .filter((m) => !m.uploading && !m.uploadError && m.type === "image")
                    .map((m, i) => {
                      const existingMedia = existingSingleVariant?.media.find((em) => em.url === m.url);
                      return {
                        dbId: existingMedia?.id,
                        url: m.url,
                        storagePath: m.storagePath ?? existingMedia?.storage_path,
                        is_main: i === 0,
                        is_hover: false,
                        display_order: i,
                      };
                    }),
                  sizes: simpleSizes.map((s) => ({
                    dbId: s.dbId, size: s.size, stock: s.stock, sku: s.sku, low_stock_alert: 5, is_active: s.is_active,
                  })),
                }]
              // Sem tamanho nenhum — se já existia uma variante única, ela é
              // excluída via removedIdsToSend abaixo (volta a ser produto
              // sem variação, estoque simples).
              : []
            : variants;
        const removedIdsToSend =
          colorMode === "single" && simpleSizes.length === 0 && existingSingleVariant
            ? [...removedVariantIds, existingSingleVariant.id]
            : removedVariantIds;
        const variantsResult = await saveVariants({ type: "product", id: product.id, baseSku: sku }, variantsToSave, removedIdsToSend);
        if (variantsResult.error) { setError(variantsResult.error); return; }
      }

      if (stockItemChanged && originalStockItemId) {
        const clearResult = await clearProductColors(product.id);
        if (clearResult.error) { setError(clearResult.error); return; }
      }

      if (origin === "linked" && linkedStockItem) {
        if (colors.length > 0) {
          const colorsResult = await saveProductColors(
            product.id,
            linkedStockItem.id,
            colors,
            stockItemChanged ? [] : removedColorIds
          );
          if (colorsResult.error) { setError(colorsResult.error); return; }
        } else if (!stockItemChanged && removedColorIds.length > 0) {
          // Produto inativo, todas as cores removidas — aplica as remoções
          // sem exigir o mínimo de 1 cor (que só vale pra produto ativo).
          const clearResult = await clearProductColors(product.id);
          if (clearResult.error) { setError(clearResult.error); return; }
        }
      }

      // Recarrega os dados do servidor (product.media atualizado) e confirma
      // visualmente o sucesso — antes não havia nenhum feedback após salvar,
      // o que mascarava falhas silenciosas como a do bug de imagem.
      router.refresh();
      // Move a "linha de base" do que está salvo para o estado atual, senão
      // o aviso de alterações não salvas continuaria disparando após salvar.
      initialSnapshotRef.current = currentSnapshot;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  };

  const confirmLeave = () => {
    const href = pendingNavHref;
    setPendingNavHref(null);
    if (href) router.push(href);
  };

  const handleDelete = () => {
    if (
      !confirm(
        `Excluir o produto "${product.name}"? Esta ação não pode ser desfeita.`
      )
    )
      return;

    startTransition(async () => {
      const result = await deleteProduct(product.id);
      if (result.error) {
        setError(result.error);
      } else {
        router.push(routes.admin.produtos);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={routes.admin.produtos}>
            <button className="w-8 h-8 rounded-lg bg-dark-alt border border-dark-border flex items-center justify-center hover:bg-dark-hover transition-colors">
              <ArrowLeft size={15} className="text-muted" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-dark-text">Editar produto</h1>
            <p className="text-xs text-muted font-mono">{product.sku}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 size={14} />}
            onClick={handleDelete}
            isLoading={isPending}
          >
            Excluir
          </Button>
          <Button
            variant="accent"
            size="sm"
            leftIcon={<Save size={14} />}
            onClick={handleSave}
            isLoading={isPending}
          >
            Salvar
          </Button>
        </div>
      </div>

      {/* Botão Salvar flutuante — sempre acessível, mesmo rolado para baixo */}
      <button
        onClick={handleSave}
        disabled={isPending}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-full bg-accent text-dark-bg font-semibold text-sm shadow-2xl shadow-accent/30 hover:bg-accent-light hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
      >
        {isPending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Save size={16} />
        )}
        Salvar
      </button>

      <Modal isOpen={pendingNavHref !== null} onClose={() => setPendingNavHref(null)} size="sm">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-warning/15 flex items-center justify-center">
            <AlertTriangle size={26} className="text-warning" />
          </div>
          <div>
            <h3 className="text-base font-bold text-dark-text">Alterações não salvas</h3>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              Este produto foi modificado e as alterações ainda não foram salvas.
              Se você sair agora, elas serão perdidas.
            </p>
          </div>
          <div className="flex gap-3 w-full mt-1">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setPendingNavHref(null)}
            >
              Continuar editando
            </Button>
            <Button variant="danger" className="flex-1" onClick={confirmLeave}>
              Sair sem salvar
            </Button>
          </div>
        </div>
      </Modal>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">
          {error}
        </div>
      )}

      {saved && (
        <div className="fixed top-6 right-6 z-[60] flex items-center gap-3 pl-3 pr-5 py-3 rounded-xl border border-success/30 bg-dark-surface shadow-2xl shadow-black/40 animate-slide-in-right">
          <div className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={16} className="text-success" />
          </div>
          <div>
            <p className="text-sm font-semibold text-dark-text">Produto salvo</p>
            <p className="text-xs text-muted">Alterações publicadas com sucesso.</p>
          </div>
        </div>
      )}

      {!isActive && (
        <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-xl text-sm text-warning">
          <EyeOff size={16} className="flex-shrink-0 mt-0.5" />
          <p>
            Este produto está <strong>inativo</strong> e não aparece em nenhuma página
            do site (Home, Catálogo, busca ou link direto). Ative o toggle &quot;Ativo&quot;
            abaixo e salve para publicá-lo.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-5">

          <SectionCard title="Origem do produto" hint="De onde vêm cor, tamanho, imagens e estoque deste produto">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOrigin("manual")}
                className={[
                  "flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
                  origin === "manual"
                    ? "bg-accent/10 border-accent text-accent"
                    : "bg-dark-alt border-dark-border-light text-muted hover:text-dark-text",
                ].join(" ")}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setOrigin("linked")}
                className={[
                  "flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
                  origin === "linked"
                    ? "bg-accent/10 border-accent text-accent"
                    : "bg-dark-alt border-dark-border-light text-muted hover:text-dark-text",
                ].join(" ")}
              >
                Vinculado a uma peça do estoque
              </button>
            </div>
            {origin === "linked" && (
              <div className="mt-4">
                <StockItemLinkPicker
                  value={linkedStockItem}
                  excludeProductId={product.id}
                  onSelect={setLinkedStockItem}
                />
              </div>
            )}
          </SectionCard>

          <SectionCard title="Informações básicas">
            <Input
              label="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Slug"
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                />
                <button
                  type="button"
                  onClick={() => setSlug(slugify(name))}
                  className="text-xs text-accent hover:underline mt-1"
                >
                  Gerar a partir do nome
                </button>
              </div>
              {origin === "linked" ? (
                <Input label="SKU" value="SKU controlado pelo estoque" disabled />
              ) : (
                <Input
                  label="SKU"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Departamento"
                value={departmentId}
                onChange={handleDepartmentChange}
                options={categoryTree}
                placeholder="Selecione o departamento"
              />
              {hasSubcategories && (
                <Select
                  label="Subcategoria"
                  value={categoryId}
                  onChange={setCategoryId}
                  options={subcategoryOptions}
                  placeholder="Selecione a subcategoria"
                />
              )}
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-xs font-medium text-dark-text mb-1.5">Ativo</p>
                <Toggle checked={isActive} onChange={setIsActive} />
              </div>
              <div>
                <p className="text-xs font-medium text-dark-text mb-1.5">Destaque</p>
                <Toggle checked={isFeatured} onChange={setIsFeatured} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Descrição">
            <Input
              label="Descrição curta"
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
            />
            <div>
              <label className="block text-xs font-medium text-dark-text mb-1.5">
                Descrição completa
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full bg-dark-alt border border-dark-border-light rounded-xl px-3 py-2.5 text-sm text-dark-text placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 resize-none transition-all"
              />
            </div>
            <Input
              label="Benefícios (opcional)"
              value={benefits}
              onChange={(e) => setBenefits(e.target.value)}
            />
            <Input
              label="Avisos (opcional)"
              value={warnings}
              onChange={(e) => setWarnings(e.target.value)}
            />
          </SectionCard>

          <SectionCard title="Preços">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Preço Pix (R$)"
                type="number"
                value={pricePix}
                onChange={(e) => setPricePix(e.target.value)}
              />
              <Input
                label="Preço Cartão (R$)"
                type="number"
                value={priceCard}
                onChange={(e) => setPriceCard(e.target.value)}
              />
              <div>
                <Input
                  label="Preço anterior (R$)"
                  type="number"
                  value={pricePromo}
                  onChange={(e) => setPricePromo(e.target.value)}
                  placeholder="—"
                />
                <HelpText text="Aparece riscado (promoção)" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-dark-text mb-1.5">Promoção ativa</p>
              <Toggle checked={promotionalActive} onChange={setPromotionalActive} />
            </div>
            <PriceTierEditor
              enabled={quantityPricingEnabled}
              onEnabledChange={setQuantityPricingEnabled}
              tiers={priceTiers}
              onTiersChange={setPriceTiers}
              basePrice={parseFloat(pricePix) || 0}
            />
          </SectionCard>

          <SectionCard
            title="Foto principal"
            hint={hasVariants ? "Esse produto já tem cor cadastrada abaixo — essas fotos aqui só servem de capa/reserva" : "Foto de capa do produto. Se ele for vendido em mais de uma cor, adicione as cores abaixo — nome, descrição e preço continuam os mesmos, só a foto muda por cor"}
          >
            {/* key=updated_at força remontagem após cada salvar bem-sucedido.
                Sem isso, o MediaUploader nunca aprende o dbId de uma imagem
                recém-inserida — ele inicializa seu estado interno UMA VEZ no
                mount e ignora mudanças posteriores na prop initialMedia.
                Resultado: a cada novo clique em "Salvar", a mesma imagem
                "nova" (sem dbId) era inserida de novo, duplicando-a no banco.
                product.updated_at sempre muda a cada updateProduct(), então
                serve como gatilho confiável de remontagem com dados frescos. */}
            <MediaUploader
              key={product.updated_at}
              productId={product.id}
              initialMedia={product.media}
              onChange={handleMediaChange}
              maxImages={5}
            />
          </SectionCard>

          {/* Logo depois da foto principal de propósito — é a continuação
              direta do mesmo pensamento ("essa é a foto, agora as cores"),
              em vez de ficar perdida lá embaixo perto de Estoque e entrega. */}
          {origin === "manual" ? (
            <SectionCard
              title={colorMode === "single" ? "Tamanhos e estoque" : "Cores deste mesmo produto"}
              hint={
                colorMode === "single"
                  ? "Adicione os tamanhos vendidos neste produto e defina o estoque individual de cada um. Sem nenhum tamanho aqui, o produto usa o estoque simples abaixo (sem variação)."
                  : "Nome, descrição e preço já estão definidos acima e valem para todas as cores. Aqui você só adiciona: nome da cor, fotos daquela cor, e os tamanhos com estoque."
              }
            >
              <div className="flex gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => setColorMode("single")}
                  className={[
                    "flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-all",
                    colorMode === "single"
                      ? "bg-accent/10 border-accent text-accent"
                      : "bg-dark-alt border-dark-border-light text-muted hover:text-dark-text",
                  ].join(" ")}
                >
                  Tamanho único
                </button>
                <button
                  type="button"
                  onClick={() => setColorMode("multi")}
                  className={[
                    "flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-all",
                    colorMode === "multi"
                      ? "bg-accent/10 border-accent text-accent"
                      : "bg-dark-alt border-dark-border-light text-muted hover:text-dark-text",
                  ].join(" ")}
                >
                  Várias cores
                </button>
              </div>
              {colorMode === "single" ? (
                // key=updated_at — mesmo motivo do MediaUploader/VariantEditor
                // abaixo: remonta com os dbIds reais depois de cada save.
                <ProductSizeEditor
                  key={product.updated_at}
                  baseSku={sku}
                  initialSizes={existingSingleVariant?.sizes}
                  onChange={setSimpleSizes}
                />
              ) : (
                <VariantEditor
                  key={product.updated_at}
                  mediaFolderId={product.id}
                  baseSku={sku}
                  initialVariants={product.variants}
                  onChange={(v, removed) => { setVariants(v); setRemovedVariantIds(removed); }}
                />
              )}
            </SectionCard>
          ) : linkedStockItem ? (
            <SectionCard
              title="Cores que aparecerão no site"
              hint="Escolha quais cores da peça vinculada este produto mostra, em que ordem, e qual é a principal. Tamanho, SKU e quantidade vêm sempre do Estoque — aqui você só ajusta a vitrine."
            >
              {colorsLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-muted text-sm">
                  <Loader2 size={16} className="animate-spin" />
                  Carregando cores…
                </div>
              ) : (
                <ProductColorCurator
                  key={linkedStockItem.id}
                  productId={product.id}
                  linkedStockItem={linkedStockItem}
                  initialColors={linkedStockItem.id === originalStockItemId ? initialColors : []}
                  onChange={(c, removed) => { setColors(c); setRemovedColorIds(removed); }}
                />
              )}
            </SectionCard>
          ) : (
            <SectionCard title="Cores que aparecerão no site">
              <p className="text-sm text-muted">
                Selecione uma peça do estoque na seção &quot;Origem do produto&quot;, no topo desta página, para escolher
                quais cores este produto vai mostrar.
              </p>
            </SectionCard>
          )}

          <SectionCard title="Selo do produto">
            <HelpText text="Imagem opcional (ex: promoção, lançamento, selo próprio) posicionada livremente sobre o card, exatamente como aparece no site." />
            <ProductBadgeEditor
              productId={product.id}
              value={badge}
              onChange={setBadge}
              previewProduct={badgePreviewProduct}
            />
          </SectionCard>

          <SectionCard title="Especificações">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Tecido"
                value={specComposicao}
                onChange={(e) => setSpecComposicao(e.target.value)}
                placeholder="Ex: 100% algodão penteado"
              />
              {origin === "linked" ? (
                <Input
                  label="Tamanhos disponíveis"
                  value={linkedSizesLabel || "—"}
                  disabled
                  helper="Vem da peça vinculada"
                />
              ) : (
                <Input
                  label="Tamanhos disponíveis"
                  value={specVolume}
                  onChange={(e) => setSpecVolume(e.target.value)}
                  placeholder="Ex: P, M, G, GG"
                />
              )}
              <Input
                label="Modelagem"
                value={specAplicacoes}
                onChange={(e) => setSpecAplicacoes(e.target.value)}
                placeholder="Ex: Regular fit"
              />
              <Input
                label="Cuidados de lavagem"
                value={specConservacao}
                onChange={(e) => setSpecConservacao(e.target.value)}
                placeholder="Ex: Lavar à máquina, água fria"
              />
            </div>
            <HelpText text="Campos em branco não aparecem na página do produto." />
          </SectionCard>

          <SectionCard title="Estoque e entrega">
            {hasVariants ? (
              <div className="rounded-xl border border-dark-border-light bg-dark-alt/40 p-3">
                <p className="text-xs font-medium text-dark-text">Estoque controlado por tamanho</p>
                <p className="text-xs text-muted mt-1">
                  {origin === "linked"
                    ? "Vem da peça vinculada (seção \"Cores que aparecerão no site\" acima) — edite cor/tamanho/quantidade em Estoque."
                    : `Definido na seção "${colorMode === "single" ? "Tamanhos e estoque" : "Cores deste mesmo produto"}" acima — os campos abaixo não se aplicam.`}
                </p>
                {origin === "manual" && (
                  <p className="text-sm text-accent font-semibold mt-2">Total: {manualStockTotal} unidades</p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-xs font-medium text-dark-text mb-1.5">Controlar estoque</p>
                <Toggle checked={trackStock} onChange={setTrackStock} />
                {!trackStock && <HelpText text="Estoque ilimitado — a quantidade não será controlada." />}
                <HelpText text="Pra vender com tamanho (ex: P, M, G) ou cor, use a seção 'Tamanhos e estoque' acima em vez destes campos." />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {!hasVariants && trackStock && (
                <Input
                  label="Estoque"
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              )}
              {!hasVariants && (
                <Input
                  label="Estoque mínimo"
                  type="number"
                  value={stockMin}
                  onChange={(e) => setStockMin(e.target.value)}
                />
              )}
              <Input
                label="Dias extras"
                type="number"
                value={handlingDays}
                onChange={(e) => setHandlingDays(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                label="Peso (kg)"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
              <Input
                label="Altura (cm)"
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
              <Input
                label="Largura (cm)"
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
              <Input
                label="Comprimento (cm)"
                type="number"
                value={length}
                onChange={(e) => setLength(e.target.value)}
              />
            </div>
          </SectionCard>

          <SectionCard title="Comportamento">
            <div className="flex gap-8 flex-wrap">
              <div>
                <p className="text-xs font-medium text-dark-text mb-1.5">WhatsApp</p>
                <Toggle checked={allowWhatsapp} onChange={setAllowWhatsapp} />
              </div>
            </div>
          </SectionCard>

        </div>

        {/* Preview */}
        <div className="sticky top-6 space-y-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">
            Preview
          </p>
          <ProductPreviewCard
            name={name}
            short_description={shortDesc}
            price_pix={parseFloat(pricePix) || product.price_pix}
            price_card={parseFloat(priceCard) || product.price_card}
            price_promotional={parseFloat(pricePromo) || undefined}
            promotional_active={promotionalActive}
            is_featured={isFeatured}
            category_name={selectedCat?.label}
            media={previewMedia}
            sku={sku}
            track_stock={origin === "manual" && hasVariants ? true : trackStock}
            stock={
              origin === "manual" && hasVariants
                ? manualStockTotal
                : trackStock ? (parseInt(stock) || 0) : null
            }
          />
        </div>
      </div>
    </div>
  );
}
