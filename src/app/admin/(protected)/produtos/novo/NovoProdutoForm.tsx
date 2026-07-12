"use client";

import React, { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { Toggle } from "@/components/common/Toggle";
import { MediaUploader } from "@/components/admin/MediaUploader";
import { ProductPreviewCard } from "@/components/admin/ProductPreviewCard";
import { PriceTierEditor } from "@/components/admin/PriceTierEditor";
import { ProductBadgeEditor } from "@/components/admin/ProductBadgeEditor";
import { VariantEditor } from "@/components/admin/VariantEditor";
import { ProductSizeEditor } from "@/components/admin/ProductSizeEditor";
import { StockItemLinkPicker } from "@/components/admin/StockItemLinkPicker";
import { ProductColorCurator } from "@/components/admin/ProductColorCurator";
import { createProduct, copyProductImagesForDraft } from "@/lib/actions/products";
import { saveMediaChanges } from "@/lib/actions/media";
import { saveVariants } from "@/lib/actions/variants";
import { saveProductColors } from "@/lib/actions/product-colors";
import { routes } from "@/lib/routes";
import { slugify } from "@/lib/formatters";
import type { ProductFormData, ProductDuplicationData } from "@/lib/actions/products";
import type { UploadedMedia } from "@/components/admin/MediaUploader";
import type { ProductBadgeValue } from "@/components/admin/ProductBadgeEditor";
import type { VariantInput } from "@/lib/actions/variants";
import type { SimpleSizeInput } from "@/components/admin/ProductSizeEditor";
import type { ProductColorInput } from "@/lib/actions/product-colors";
import type { PriceTier, ProductSpecification, ProductMedia, ProductAvailability, Product, StockItem } from "@/types";

const SPEC_LABELS = ["Tecido", "Tamanhos disponíveis", "Modelagem", "Cuidados de lavagem"] as const;

interface CategoryOption {
  value: string;
  label: string;
}

interface CategoryTreeOption extends CategoryOption {
  children: CategoryOption[];
}

// Acha o departamento (categoria de topo) ao qual uma categoria-folha
// pertence — usada para pré-selecionar o 1º select a partir de um
// category_id já existente (duplicação de produto).
function findDepartmentId(tree: CategoryTreeOption[], categoryId: string): string {
  if (!categoryId) return "";
  const direct = tree.find((d) => d.value === categoryId);
  if (direct) return direct.value; // departamento sem subcategorias, usado como folha
  const parent = tree.find((d) => d.children.some((c) => c.value === categoryId));
  return parent?.value ?? "";
}

interface Props {
  categoryTree: CategoryTreeOption[];
  /**
   * Dados do produto de origem quando este formulário foi aberto a partir de
   * "Duplicar produto". Apenas pré-preenche os campos — NADA é gravado no
   * banco até o admin clicar em Rascunho/Publicar, como qualquer criação.
   */
  duplicateFrom?: ProductDuplicationData | null;
  duplicateFromId?: string;
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

function HelpText({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-1.5 mt-1">
      <Info size={12} className="text-muted flex-shrink-0 mt-0.5" />
      <p className="text-xs text-muted">{text}</p>
    </div>
  );
}

export function NovoProdutoForm({ categoryTree, duplicateFrom, duplicateFromId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isDuplicating = !!duplicateFrom;

  // UUID gerado no cliente para que o upload possa acontecer antes do produto existir no banco
  const [productId] = useState(() => crypto.randomUUID());
  const [mediaItems, setMediaItems] = useState<UploadedMedia[]>([]);
  const [removedDbIds, setRemovedDbIds] = useState<string[]>([]);

  // Imagens copiadas no Storage a partir do produto de origem (duplicar) —
  // só existem como arquivos soltos até o admin salvar; nenhuma linha em
  // product_media é criada aqui.
  const [prefilledImages, setPrefilledImages] = useState<
    { url: string; storagePath: string; altText?: string }[]
  >([]);
  const [copyingImages, setCopyingImages] = useState(isDuplicating);

  useEffect(() => {
    if (!duplicateFromId) return;
    let cancelled = false;
    setCopyingImages(true);
    copyProductImagesForDraft(duplicateFromId, productId).then((result) => {
      if (cancelled) return;
      if (result.images) setPrefilledImages(result.images);
      setCopyingImages(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateFromId]);

  const handleMediaChange = (items: UploadedMedia[], removed: string[]) => {
    setMediaItems(items);
    setRemovedDbIds(removed);
  };

  const dupName = duplicateFrom ? `${duplicateFrom.name} (Cópia)` : "";

  // Origem do produto: manual (como sempre foi) ou vinculado a uma peça já
  // cadastrada em Estoque — nesse caso cor/tamanho/imagem/SKU vêm da peça.
  const [origin, setOrigin] = useState<"manual" | "linked">("manual");
  const [linkedStockItem, setLinkedStockItem] = useState<StockItem | null>(null);

  const [name, setName] = useState(dupName);
  const [slug, setSlug] = useState(dupName ? slugify(dupName) : "");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState(duplicateFrom?.category_id ?? "");
  const [departmentId, setDepartmentId] = useState(
    findDepartmentId(categoryTree, duplicateFrom?.category_id ?? "")
  );
  const [isActive, setIsActive] = useState(!isDuplicating);
  const [isFeatured, setIsFeatured] = useState(false);
  const [shortDesc, setShortDesc] = useState(duplicateFrom?.short_description ?? "");
  const [description, setDescription] = useState(duplicateFrom?.description ?? "");
  const [benefits, setBenefits] = useState(duplicateFrom?.benefits ?? "");
  const [warnings, setWarnings] = useState(duplicateFrom?.warnings ?? "");
  const [pricePix, setPricePix] = useState(duplicateFrom ? String(duplicateFrom.price_pix) : "");
  const [priceCard, setPriceCard] = useState(duplicateFrom ? String(duplicateFrom.price_card) : "");
  const [pricePromo, setPricePromo] = useState(
    duplicateFrom?.price_promotional != null ? String(duplicateFrom.price_promotional) : ""
  );
  const [promotionalActive, setPromotionalActive] = useState(duplicateFrom?.promotional_active ?? false);
  const [trackStock, setTrackStock] = useState(duplicateFrom?.track_stock ?? true);
  const [stock, setStock] = useState(duplicateFrom?.stock != null ? String(duplicateFrom.stock) : "0");
  const [stockMin, setStockMin] = useState(duplicateFrom ? String(duplicateFrom.stock_minimum) : "2");
  const [quantityPricingEnabled, setQuantityPricingEnabled] = useState(
    duplicateFrom?.quantity_pricing_enabled ?? false
  );
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>(duplicateFrom?.price_tiers ?? []);
  const dupSpecs = new Map((duplicateFrom?.specifications ?? []).map((s) => [s.label, s.value]));
  const [specComposicao, setSpecComposicao] = useState(dupSpecs.get("Tecido") ?? "");
  const [specVolume, setSpecVolume] = useState(dupSpecs.get("Tamanhos disponíveis") ?? "");
  const [specAplicacoes, setSpecAplicacoes] = useState(dupSpecs.get("Modelagem") ?? "");
  const [specConservacao, setSpecConservacao] = useState(dupSpecs.get("Cuidados de lavagem") ?? "");
  const [weight, setWeight] = useState(duplicateFrom ? String(duplicateFrom.weight_kg) : "0.1");
  const [height, setHeight] = useState(duplicateFrom ? String(duplicateFrom.height_cm) : "10");
  const [width, setWidth] = useState(duplicateFrom ? String(duplicateFrom.width_cm) : "10");
  const [length, setLength] = useState(duplicateFrom ? String(duplicateFrom.length_cm) : "10");
  const [handlingDays, setHandlingDays] = useState(
    duplicateFrom ? String(duplicateFrom.extra_handling_days) : "0"
  );
  const [allowWhatsapp, setAllowWhatsapp] = useState(duplicateFrom?.allow_whatsapp ?? true);
  // Manual: "Tamanho único" (sem cor, a maioria da roupa simples) ou "Várias
  // cores" — os dois salvam na mesma estrutura (product_variants +
  // product_variant_sizes), só a UI muda. Produto novo sempre começa no
  // modo simples.
  const [colorMode, setColorMode] = useState<"single" | "multi">("single");
  const [simpleSizes, setSimpleSizes] = useState<SimpleSizeInput[]>([]);
  const [variants, setVariants] = useState<VariantInput[]>([]);
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);
  const [colors, setColors] = useState<ProductColorInput[]>([]);
  const [removedColorIds, setRemovedColorIds] = useState<string[]>([]);
  const manualSizes = colorMode === "single" ? simpleSizes : variants.flatMap((v) => v.sizes);
  const hasVariants =
    origin === "linked" ? (linkedStockItem?.variants.length ?? 0) > 0 : manualSizes.length > 0;
  const manualStockTotal = manualSizes.reduce((sum, s) => sum + (Number(s.stock) || 0), 0);

  // Selo nunca é copiado ao duplicar — começa sempre vazio, propositalmente
  // (mesma lógica de slug/sku: cada produto novo escolhe o seu).
  const [badge, setBadge] = useState<ProductBadgeValue | null>(null);

  const selectedDepartment = categoryTree.find((d) => d.value === departmentId);
  const subcategoryOptions = selectedDepartment?.children ?? [];
  const hasSubcategories = subcategoryOptions.length > 0;
  const selectedCat = hasSubcategories
    ? subcategoryOptions.find((c) => c.value === categoryId)
    : selectedDepartment;

  const handleDepartmentChange = (id: string) => {
    setDepartmentId(id);
    const dept = categoryTree.find((d) => d.value === id);
    // Departamento sem subcategorias funciona como folha — usa o próprio id.
    // Com subcategorias, zera a categoria até o admin escolher uma.
    setCategoryId(dept && dept.children.length === 0 ? id : "");
  };

  // Vinculado, o preview usa as imagens da cor principal escolhida na
  // curadoria — não o uploader "Foto principal" (que nesse modo é só capa
  // de reserva, conforme o hint da seção abaixo). Sem cor principal ainda,
  // cai no uploader normal.
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

  // Produto "ao vivo" a partir do estado atual, SEM badge — usado apenas
  // como contexto visual no ProductBadgeEditor (o selo é desenhado por
  // cima, arrastável, separadamente).
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
      product_id:    productId,
      type:          m.type,
      url:           m.url,
      alt_text:      m.alt_text,
      display_order: i,
      is_main:       i === 0,
      created_at:    new Date().toISOString(),
    }));

  const badgePreviewProduct: Product = {
    id:                  productId,
    name:                name || "Nome do produto",
    slug:                slug || "produto",
    sku:                 sku || "SKU-000",
    category_id:         categoryId,
    display_order:       0,
    price_pix:           parseFloat(pricePix)  || 0,
    price_card:          parseFloat(priceCard) || 0,
    price_promotional:   parseFloat(pricePromo) || undefined,
    promotional_active:  promotionalActive,
    is_active:           true, // só preview visual no editor — não é salvo
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
    created_at:          new Date().toISOString(),
    updated_at:          new Date().toISOString(),
  };

  const buildPayload = (
    publish: boolean
  ): ProductFormData => ({
    name,
    slug,
    sku: origin === "linked" ? (linkedStockItem?.base_sku ?? "") : sku,
    stock_item_id:       origin === "linked" ? (linkedStockItem?.id ?? null) : null,
    category_id:         categoryId,
    price_pix:           parseFloat(pricePix)  || 0,
    price_card:          parseFloat(priceCard) || 0,
    price_promotional:   parseFloat(pricePromo) || null,
    promotional_active:  promotionalActive,
    is_active:           publish ? true : false,
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

  const handleSave = (publish: boolean) => {
    setError(null);

    if (origin === "linked" && !linkedStockItem) {
      setError("Selecione uma peça do estoque para vincular, ou troque para \"Manual\".");
      return;
    }
    if (origin === "linked" && publish && colors.length < 1) {
      setError("Adicione pelo menos uma cor da peça vinculada antes de publicar.");
      return;
    }

    // "Tamanho único" usa a "Foto principal" como imagem da variante única
    // (sem pedir upload separado) — por isso sempre exige foto nesse modo,
    // igual ao produto sem variação nenhuma. "Várias cores" já tem suas
    // próprias fotos por cor, então a foto principal vira opcional ali.
    const imageCount = mediaItems.filter((m) => m.type === "image" && !m.uploadError).length;
    const needsTopImage = origin === "manual" && (colorMode === "single" || !hasVariants);
    if (needsTopImage && imageCount < 1) {
      setError("Adicione pelo menos 1 imagem do produto.");
      return;
    }

    startTransition(async () => {
      const payload = buildPayload(publish);
      // Passa o productId pré-gerado para que as imagens já no storage usem o mesmo diretório
      const result = await createProduct({ ...payload, id: productId });
      if (result.error) {
        setError(result.error);
        return;
      }
      // Salva as mídias coletadas pelo MediaUploader
      const mediaResult = await saveMediaChanges(productId, mediaItems, removedDbIds);
      if (mediaResult.error) {
        setError(mediaResult.error);
        return;
      }
      // Salva as cores/tamanhos — só no modo manual. Vinculado a uma peça, as
      // variações já existem em Estoque. "Tamanho único" monta 1 variante com
      // cor neutra (nunca exibida) usando as fotos da "Foto principal" — sem
      // isso, a galeria da PDP ficaria vazia (ela usa a mídia da variante,
      // não a do produto, quando há variação).
      if (origin === "manual") {
        const variantsToSave: VariantInput[] =
          colorMode === "single"
            ? simpleSizes.length > 0
              ? [{
                  color_name: "Padrão",
                  color_hex: "#000000",
                  display_order: 0,
                  is_active: true,
                  media: mediaItems
                    .filter((m) => !m.uploading && !m.uploadError && m.type === "image")
                    .map((m, i) => ({ url: m.url, storagePath: m.storagePath, is_main: i === 0, is_hover: false, display_order: i })),
                  sizes: simpleSizes.map((s) => ({
                    size: s.size, stock: s.stock, sku: s.sku, low_stock_alert: 5, is_active: s.is_active,
                  })),
                }]
              : []
            : variants;
        const variantsResult = await saveVariants({ type: "product", id: productId, baseSku: sku }, variantsToSave, removedVariantIds);
        if (variantsResult.error) {
          setError(variantsResult.error);
          return;
        }
      }
      // Salva a curadoria de cores (quais cores da peça aparecem, ordem,
      // principal, imagens por cor) — só no modo vinculado, e só se houver
      // ao menos uma cor (rascunho pode ficar sem nenhuma; publicar já
      // bloqueou isso acima).
      if (origin === "linked" && linkedStockItem && colors.length > 0) {
        const colorsResult = await saveProductColors(productId, linkedStockItem.id, colors, removedColorIds);
        if (colorsResult.error) {
          setError(colorsResult.error);
          return;
        }
      }
      router.push(routes.admin.produtos);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={routes.admin.produtos}>
            <button className="w-8 h-8 rounded-lg bg-dark-alt border border-dark-border flex items-center justify-center hover:bg-dark-hover transition-colors">
              <ArrowLeft size={15} className="text-muted" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-dark-text">
              {isDuplicating ? "Duplicar produto" : "Criar produto"}
            </h1>
            <p className="text-xs text-muted">
              {isDuplicating
                ? "Campos pré-preenchidos a partir do produto original — nada foi salvo ainda. Defina slug e SKU próprios e publique quando estiver pronto."
                : "Preencha os campos e publique"}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Save size={14} />}
            onClick={() => handleSave(false)}
            isLoading={isPending}
            disabled={copyingImages}
          >
            Rascunho
          </Button>
          <Button
            variant="accent"
            size="sm"
            leftIcon={<Save size={14} />}
            onClick={() => handleSave(true)}
            isLoading={isPending}
            disabled={copyingImages}
          >
            Publicar
          </Button>
        </div>
      </div>

      {/* Botão Publicar flutuante — sempre acessível, mesmo rolado para baixo */}
      <button
        onClick={() => handleSave(true)}
        disabled={isPending || copyingImages}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-full bg-accent text-dark-bg font-semibold text-sm shadow-2xl shadow-accent/30 hover:bg-accent-light hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
      >
        {isPending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Save size={16} />
        )}
        Publicar
      </button>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">
          {error}
        </div>
      )}

      {isDuplicating && (
        <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-xl text-sm text-warning">
          <Info size={16} className="flex-shrink-0 mt-0.5" />
          <p>
            Nada foi gravado no banco ainda. Este é só um rascunho em tela — ele só
            passa a existir como produto quando você clicar em &quot;Rascunho&quot; ou
            &quot;Publicar&quot;. Slug e SKU foram deixados em branco de propósito: escolha
            valores únicos antes de salvar.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Coluna principal */}
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
                <StockItemLinkPicker value={linkedStockItem} onSelect={setLinkedStockItem} />
              </div>
            )}
          </SectionCard>

          <SectionCard title="Informações básicas" hint="Nome e identificadores do produto">
            <Input
              label="Nome do produto"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(slugify(e.target.value));
              }}
              placeholder="Ex: Camiseta Básica Masculina — Preta"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Slug (URL)"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="camiseta-basica-masculina-preta"
              />
              {origin === "linked" ? (
                <Input label="SKU" value="SKU controlado pelo estoque" disabled />
              ) : (
                <Input
                  label="SKU"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="TRZ-5MG-001"
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
                <p className="text-xs font-medium text-dark-text mb-1.5">Destaque na home</p>
                <Toggle checked={isFeatured} onChange={setIsFeatured} />
                <HelpText text="Aparece na seção de destaques" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Descrição" hint="Textos que aparecem na página do produto">
            <Input
              label="Descrição curta"
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              placeholder="Uma frase resumindo o produto"
            />
            <div>
              <label className="block text-xs font-medium text-dark-text mb-1.5">
                Descrição completa
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o produto em detalhes: benefícios, modo de uso, composição..."
                rows={5}
                className="w-full bg-dark-alt border border-dark-border-light rounded-xl px-3 py-2.5 text-sm text-dark-text placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 resize-none transition-all"
              />
            </div>
            <Input
              label="Benefícios (opcional)"
              value={benefits}
              onChange={(e) => setBenefits(e.target.value)}
              placeholder="Separe por vírgula ou deixe em branco"
            />
            <Input
              label="Avisos / contraindicações (opcional)"
              value={warnings}
              onChange={(e) => setWarnings(e.target.value)}
              placeholder="Ex: Não usar em gestantes"
            />
          </SectionCard>

          <SectionCard title="Preços">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Input
                  label="Preço Pix (R$)"
                  type="number"
                  value={pricePix}
                  onChange={(e) => setPricePix(e.target.value)}
                  placeholder="0,00"
                />
                <HelpText text="Valor com desconto para Pix" />
              </div>
              <div>
                <Input
                  label="Preço Cartão (R$)"
                  type="number"
                  value={priceCard}
                  onChange={(e) => setPriceCard(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Input
                  label="Preço anterior (R$)"
                  type="number"
                  value={pricePromo}
                  onChange={(e) => setPricePromo(e.target.value)}
                  placeholder="0,00"
                />
                <HelpText text="Aparece riscado (promoção)" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-dark-text mb-1.5">Ativar promoção</p>
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
            {copyingImages ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted text-sm">
                <Loader2 size={16} className="animate-spin" />
                Copiando imagens do produto original…
              </div>
            ) : (
              // key garante remontagem com prefilledImages já resolvido —
              // o estado inicial do MediaUploader só lê essa prop uma vez.
              <MediaUploader
                key={productId}
                productId={productId}
                prefilledImages={prefilledImages}
                onChange={handleMediaChange}
                maxImages={5}
              />
            )}
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
                <ProductSizeEditor baseSku={sku} onChange={setSimpleSizes} />
              ) : (
                <VariantEditor
                  mediaFolderId={productId}
                  baseSku={sku}
                  onChange={(v, removed) => { setVariants(v); setRemovedVariantIds(removed); }}
                />
              )}
            </SectionCard>
          ) : linkedStockItem ? (
            <SectionCard
              title="Cores que aparecerão no site"
              hint="Escolha quais cores da peça vinculada este produto mostra, em que ordem, e qual é a principal. Tamanho, SKU e quantidade vêm sempre do Estoque — aqui você só ajusta a vitrine."
            >
              <ProductColorCurator
                productId={productId}
                linkedStockItem={linkedStockItem}
                onChange={(c, removed) => { setColors(c); setRemovedColorIds(removed); }}
              />
            </SectionCard>
          ) : (
            <SectionCard title="Cores que aparecerão no site">
              <p className="text-sm text-muted">
                Selecione uma peça do estoque na seção &quot;Origem do produto&quot;, no topo desta página, para escolher
                quais cores este produto vai mostrar.
              </p>
            </SectionCard>
          )}

          <SectionCard title="Selo do produto" hint="Imagem opcional posicionada livremente sobre o card, exatamente como aparece no site">
            <ProductBadgeEditor
              productId={productId}
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
                    ? "Vem da peça vinculada (seção \"Cores que aparecerão no site\" acima) — os campos abaixo não se aplicam."
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
                  label="Estoque atual"
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                />
              )}
              {!hasVariants && (
                <Input
                  label="Estoque mínimo"
                  type="number"
                  value={stockMin}
                  onChange={(e) => setStockMin(e.target.value)}
                  placeholder="2"
                />
              )}
              <Input
                label="Dias extras de manuseio"
                type="number"
                value={handlingDays}
                onChange={(e) => setHandlingDays(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                label="Peso (kg)"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0.1"
              />
              <Input
                label="Altura (cm)"
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="10"
              />
              <Input
                label="Largura (cm)"
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="10"
              />
              <Input
                label="Comprimento (cm)"
                type="number"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                placeholder="10"
              />
            </div>
          </SectionCard>

          <SectionCard title="Comportamento">
            <div className="flex gap-8 flex-wrap">
              <div>
                <p className="text-xs font-medium text-dark-text mb-1.5">Permitir WhatsApp</p>
                <Toggle checked={allowWhatsapp} onChange={setAllowWhatsapp} />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Coluna de preview */}
        <div>
          <div className="sticky top-6">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Preview
            </p>
            <ProductPreviewCard
              name={name || undefined}
              short_description={shortDesc}
              price_pix={parseFloat(pricePix) || 0}
              price_card={parseFloat(priceCard) || 0}
              price_promotional={parseFloat(pricePromo) || undefined}
              promotional_active={promotionalActive}
              is_featured={isFeatured}
              category_name={selectedCat?.label}
              media={previewMedia}
              sku={sku || undefined}
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
    </div>
  );
}
