"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Upload, X, Star, Sun, ImageIcon, Loader2, AlertCircle, Plus, Trash2,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Crown,
} from "lucide-react";
import { Button } from "@/components/common/Button";
import { extractDroppedImageUrl } from "@/lib/drag-image-url";
import type { StockItem, ProductVariant, ProductColor } from "@/types";
import type { ProductColorInput, ProductColorImageInput } from "@/lib/actions/product-colors";

const MAX_IMAGES = 5;

function extractStoragePath(url: string): string | undefined {
  const marker = "/storage/v1/object/public/product-images/";
  const idx = url.indexOf(marker);
  if (idx === -1) return undefined;
  return url.slice(idx + marker.length);
}

// ---------------------------------------------------------------------------
// Tipos de estado local (UI)
// ---------------------------------------------------------------------------

interface ImageItem {
  localId: string;
  dbId?: string;
  url: string;
  storagePath?: string;
  source: "stock" | "upload";
  stockMediaId?: string;
  isPrimary: boolean;
  isHover: boolean;
  displayOrder: number;
  uploading: boolean;
  uploadError?: string;
}

interface ColorItem {
  localId: string;
  dbId?: string;
  variantId: string;
  displayOrder: number;
  isMain: boolean;
  images: ImageItem[];
}

function toColorInputs(colors: ColorItem[]): ProductColorInput[] {
  return colors.map((c, i) => ({
    dbId: c.dbId,
    variantId: c.variantId,
    display_order: i,
    is_main: c.isMain,
    images: c.images.map((img, j): ProductColorImageInput => ({
      dbId: img.dbId,
      url: img.url,
      storagePath: img.storagePath,
      source: img.source,
      stockMediaId: img.stockMediaId,
      is_primary: img.isPrimary,
      is_hover: img.isHover,
      display_order: j,
    })),
  }));
}

// Imagens da cor importadas do Estoque — cópia/snapshot, nunca espelho vivo.
function imagesFromVariant(variant: ProductVariant): ImageItem[] {
  return variant.media.map((m) => ({
    localId: `stock-${m.id}`,
    url: m.url,
    storagePath: m.storage_path,
    source: "stock" as const,
    stockMediaId: m.id,
    isPrimary: m.is_main,
    isHover: m.is_hover,
    displayOrder: m.display_order,
    uploading: false,
  }));
}

function imagesFromProductColor(pc: ProductColor): ImageItem[] {
  return pc.images
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((img) => ({
      localId: img.id,
      dbId: img.id,
      url: img.url,
      storagePath: img.storage_path,
      source: img.source,
      stockMediaId: img.stock_media_id,
      isPrimary: img.is_primary,
      isHover: img.is_hover,
      displayOrder: img.display_order,
      uploading: false,
    }));
}

// ---------------------------------------------------------------------------
// Upload/gestão de imagens de UMA cor dentro do produto
// ---------------------------------------------------------------------------

function ColorImageUploader({
  mediaFolderId,
  images,
  onChange,
}: {
  mediaFolderId: string;
  images: ImageItem[];
  onChange: (next: ImageItem[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const uploadFile = async (file: File) => {
    const localId = `local-${Date.now()}-${Math.random()}`;
    const pending: ImageItem = {
      localId,
      url: URL.createObjectURL(file),
      source: "upload",
      isPrimary: images.length === 0,
      isHover: false,
      displayOrder: images.length,
      uploading: true,
    };
    onChange([...images, pending]);

    const form = new FormData();
    form.append("file", file);
    form.append("productId", mediaFolderId);

    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const json = await res.json();

      if (!res.ok) {
        onChange([...images, pending].map((it) =>
          it.localId === localId ? { ...it, uploading: false, uploadError: json.error ?? "Erro no upload" } : it
        ));
        return;
      }

      onChange([...images, pending].map((it) =>
        it.localId === localId
          ? { ...it, url: json.url, storagePath: json.storagePath, uploading: false, uploadError: undefined }
          : it
      ));
    } catch {
      onChange([...images, pending].map((it) =>
        it.localId === localId ? { ...it, uploading: false, uploadError: "Falha na conexão" } : it
      ));
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const slots = MAX_IMAGES - images.length;
    if (slots <= 0) return;
    Array.from(files).slice(0, slots).forEach((file) => uploadFile(file));
  };

  const uploadFromUrl = async (url: string) => {
    if (images.length >= MAX_IMAGES) return;
    const localId = `local-${Date.now()}-${Math.random()}`;
    const pending: ImageItem = {
      localId, url, source: "upload",
      isPrimary: images.length === 0, isHover: false,
      displayOrder: images.length, uploading: true,
    };
    onChange([...images, pending]);

    try {
      const res = await fetch("/api/admin/upload-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, productId: mediaFolderId }),
      });
      const json = await res.json();

      onChange([...images, pending].map((it) =>
        it.localId === localId
          ? !res.ok
            ? { ...it, uploading: false, uploadError: json.error ?? "Erro ao baixar imagem" }
            : { ...it, url: json.url, storagePath: json.storagePath, uploading: false, uploadError: undefined }
          : it
      ));
    } catch {
      onChange([...images, pending].map((it) =>
        it.localId === localId ? { ...it, uploading: false, uploadError: "Falha na conexão" } : it
      ));
    }
  };

  // Remover do produto nunca apaga o arquivo do estoque (source='stock') —
  // o produto não é dono desse arquivo. Para uploads próprios (source=
  // 'upload') ainda não salvos no banco, libera o arquivo órfão no Storage.
  const removeItem = async (item: ImageItem) => {
    if (item.uploading) return;
    if (!item.dbId && item.source === "upload" && item.storagePath) {
      await fetch(`/api/admin/upload?path=${encodeURIComponent(item.storagePath)}`, { method: "DELETE" });
    }
    const next = images
      .filter((m) => m.localId !== item.localId)
      .map((m, i) => ({ ...m, displayOrder: i }));
    // Garante que sempre exista uma principal, se houver alguma imagem restante.
    if (next.length > 0 && !next.some((m) => m.isPrimary)) next[0].isPrimary = true;
    onChange(next);
  };

  const setPrimary = (item: ImageItem) => {
    onChange(images.map((m) => ({ ...m, isPrimary: m.localId === item.localId })));
  };

  const setHover = (item: ImageItem) => {
    onChange(images.map((m) => ({ ...m, isHover: m.localId === item.localId ? !m.isHover : false })));
  };

  const move = (item: ImageItem, dir: -1 | 1) => {
    const idx = images.findIndex((m) => m.localId === item.localId);
    const swapIdx = idx + dir;
    if (idx === -1 || swapIdx < 0 || swapIdx >= images.length) return;
    const next = images.slice();
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    onChange(next.map((m, i) => ({ ...m, displayOrder: i })));
  };

  const canAdd = images.length < MAX_IMAGES;

  return (
    <div className="space-y-3">
      {canAdd && (
        <div
          onDragEnter={(e) => { e.preventDefault(); dragCounter.current += 1; setDragging(true); }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            e.preventDefault();
            dragCounter.current = Math.max(0, dragCounter.current - 1);
            if (dragCounter.current === 0) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter.current = 0;
            setDragging(false);
            if (e.dataTransfer.files.length > 0) {
              handleFiles(e.dataTransfer.files);
            } else {
              const url = extractDroppedImageUrl(e.dataTransfer);
              if (url) uploadFromUrl(url);
            }
          }}
          onClick={() => inputRef.current?.click()}
          className={[
            "border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-150",
            dragging ? "border-accent bg-accent/5" : "border-dark-border-light hover:border-accent/40 hover:bg-dark-hover",
          ].join(" ")}
        >
          <Upload size={18} className="text-muted" />
          <p className="text-xs text-muted text-center">
            Arraste ou clique para enviar fotos desta cor · {images.length}/{MAX_IMAGES}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((item, i) => (
            <div key={item.localId} className="relative group aspect-square bg-dark-alt rounded-lg overflow-hidden border border-dark-border">
              {item.uploading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 size={18} className="text-accent animate-spin" />
                </div>
              ) : item.uploadError ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
                  <AlertCircle size={16} className="text-danger" />
                  <p className="text-[10px] text-danger text-center leading-tight">{item.uploadError}</p>
                </div>
              ) : (
                <Image src={item.url} alt={`Imagem ${i + 1}`} fill className="object-cover" unoptimized />
              )}

              {!item.uploading && !item.uploadError && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 flex flex-col justify-between p-1">
                  <div className="flex justify-between">
                    <div className="flex gap-0.5">
                      <button onClick={() => move(item, -1)} disabled={i === 0} className="w-5 h-5 bg-black/60 rounded flex items-center justify-center hover:bg-black/80 disabled:opacity-30" title="Mover antes">
                        <ChevronLeft size={11} className="text-white" />
                      </button>
                      <button onClick={() => move(item, 1)} disabled={i === images.length - 1} className="w-5 h-5 bg-black/60 rounded flex items-center justify-center hover:bg-black/80 disabled:opacity-30" title="Mover depois">
                        <ChevronRight size={11} className="text-white" />
                      </button>
                    </div>
                    <button onClick={() => removeItem(item)} className="w-5 h-5 bg-danger rounded flex items-center justify-center hover:bg-danger/80" title="Remover do produto (não apaga do Estoque)">
                      <X size={11} className="text-white" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => setPrimary(item)}
                      className={["flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium", item.isPrimary ? "bg-accent text-dark-bg" : "bg-black/60 text-white hover:bg-black/80"].join(" ")}
                      title="Definir como imagem principal da cor"
                    >
                      <Star size={10} />
                      Principal
                    </button>
                    <button
                      onClick={() => setHover(item)}
                      className={["flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium", item.isHover ? "bg-accent text-dark-bg" : "bg-black/60 text-white hover:bg-black/80"].join(" ")}
                      title="Marcar como imagem de hover"
                    >
                      <Sun size={10} />
                      Hover
                    </button>
                  </div>
                </div>
              )}

              {item.isPrimary && !item.uploading && !item.uploadError && (
                <div className="absolute top-1 left-1 bg-black/60 rounded px-1 py-0.5 pointer-events-none">
                  <Star size={10} className="text-accent fill-accent" />
                </div>
              )}
              {item.source === "stock" && !item.uploading && !item.uploadError && (
                <div className="absolute top-1 right-1 bg-black/60 rounded px-1 py-0.5 pointer-events-none" title="Importada do Estoque">
                  <ImageIcon size={10} className="text-muted" />
                </div>
              )}
              {item.isHover && !item.uploading && !item.uploadError && (
                <div className="absolute bottom-0 left-0 right-0 py-0.5 bg-accent/90 text-center pointer-events-none">
                  <span className="text-[10px] text-dark-bg font-semibold">Hover</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {images.length === 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <ImageIcon size={12} />
          Nenhuma imagem para esta cor — o cliente não verá essa cor corretamente no site.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seletor de "+ Adicionar nova cor" — só cores já existentes na peça
// vinculada, nunca cria cor livre.
// ---------------------------------------------------------------------------

function AddColorPicker({ options, onPick }: { options: ProductVariant[]; onPick: (v: ProductVariant) => void }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <Button type="button" variant="secondary" leftIcon={<Plus size={14} />} onClick={() => setOpen((o) => !o)}>
        Adicionar nova cor
      </Button>
      {open && (
        <div className="absolute z-20 mt-1 w-64 bg-dark-surface border border-dark-border-light rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {options.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => { onPick(v); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-dark-hover transition-colors"
            >
              <span className="w-5 h-5 rounded-full border border-dark-border-light flex-shrink-0" style={{ backgroundColor: v.color_hex }} />
              <span className="text-sm text-dark-text">{v.color_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

interface Props {
  // Pasta no Storage onde as fotos de cada cor são salvas (productId).
  productId: string;
  // Peça completa vinculada — fonte das cores disponíveis (nome, hex,
  // tamanhos, SKU, estoque), sempre lida ao vivo, nunca duplicada aqui.
  linkedStockItem: StockItem;
  // Curadoria já salva (produto em edição) — vazio para produto novo.
  initialColors?: ProductColor[];
  onChange: (colors: ProductColorInput[], removedColorIds: string[]) => void;
}

export function ProductColorCurator({ productId, linkedStockItem, initialColors = [], onChange }: Props) {
  const [colors, setColors] = useState<ColorItem[]>(() => {
    if (initialColors.length > 0) {
      return initialColors
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map((pc) => ({
          localId: pc.id,
          dbId: pc.id,
          variantId: pc.variant_id,
          displayOrder: pc.display_order,
          isMain: pc.is_main,
          images: imagesFromProductColor(pc),
        }));
    }
    // Peça recém-vinculada, sem curadoria salva ainda — pré-seleciona todas
    // as cores ativas, na ordem da peça, primeira = principal, imagens
    // importadas do estoque. Mesmo critério do backfill da migration 016.
    return linkedStockItem.variants
      .filter((v) => v.is_active)
      .map((v, i) => ({
        localId: v.id,
        variantId: v.id,
        displayOrder: i,
        isMain: i === 0,
        images: imagesFromVariant(v),
      }));
  });
  const [removedColorIds, setRemovedColorIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const notify = useCallback((next: ColorItem[], removed: string[]) => {
    onChange(toColorInputs(next), removed);
  }, [onChange]);

  // Notifica o pai logo no mount — necessário pro estado inicial (cores
  // pré-selecionadas ou já salvas) ficar disponível pro submit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { notify(colors, removedColorIds); }, []);

  const variantById = new Map(linkedStockItem.variants.map((v) => [v.id, v]));
  const availableToAdd = linkedStockItem.variants.filter((v) => !colors.some((c) => c.variantId === v.id));

  const updateColors = (next: ColorItem[]) => {
    setColors(next);
    notify(next, removedColorIds);
  };

  const moveColor = (localId: string, dir: -1 | 1) => {
    const idx = colors.findIndex((c) => c.localId === localId);
    const swapIdx = idx + dir;
    if (idx === -1 || swapIdx < 0 || swapIdx >= colors.length) return;
    const next = colors.slice();
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    updateColors(next);
  };

  const setMain = (localId: string) => {
    updateColors(colors.map((c) => ({ ...c, isMain: c.localId === localId })));
  };

  const removeColor = (localId: string) => {
    const target = colors.find((c) => c.localId === localId);
    let next = colors.filter((c) => c.localId !== localId);
    if (target?.isMain && next.length > 0) {
      next = next.map((c, i) => ({ ...c, isMain: i === 0 }));
    }
    const nextRemoved = target?.dbId ? [...removedColorIds, target.dbId] : removedColorIds;
    setColors(next);
    setRemovedColorIds(nextRemoved);
    notify(next, nextRemoved);
    setExpandedId((cur) => (cur === localId ? null : cur));
  };

  const addColor = (variant: ProductVariant) => {
    const item: ColorItem = {
      localId: variant.id,
      variantId: variant.id,
      displayOrder: colors.length,
      isMain: colors.length === 0,
      images: imagesFromVariant(variant),
    };
    updateColors([...colors, item]);
    setExpandedId(item.localId);
  };

  const updateColorImages = (localId: string, images: ImageItem[]) => {
    updateColors(colors.map((c) => (c.localId === localId ? { ...c, images } : c)));
  };

  const colorStock = (variant: ProductVariant) => variant.sizes.reduce((s, sz) => s + sz.stock, 0);
  const colorSizes = (variant: ProductVariant) => variant.sizes.map((s) => s.size).join(", ");

  return (
    <div className="space-y-3">
      {colors.length === 0 && (
        <p className="text-xs text-muted">
          Nenhuma cor adicionada ainda — selecione ao menos uma cor da peça vinculada para este produto aparecer no site.
        </p>
      )}

      {colors.map((c, i) => {
        const variant = variantById.get(c.variantId);
        if (!variant) return null;
        const isExpanded = expandedId === c.localId;
        const warnNoStock = colorStock(variant) <= 0;
        const warnNoImages = c.images.length === 0;
        const warnInactive = !variant.is_active;
        const hasWarning = warnNoStock || warnNoImages || warnInactive;

        if (!isExpanded) {
          return (
            <div key={c.localId} className="flex items-center gap-3 border border-dark-border rounded-xl p-3 bg-dark-alt/30">
              <span className="w-8 h-8 rounded-full border border-dark-border-light flex-shrink-0" style={{ backgroundColor: variant.color_hex }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dark-text truncate flex items-center gap-1.5">
                  {variant.color_name}
                  {c.isMain && <Crown size={12} className="text-accent" />}
                </p>
                <p className="text-xs text-muted">
                  {colorStock(variant)} un. · tamanhos {colorSizes(variant) || "—"} · {c.images.length} foto{c.images.length !== 1 ? "s" : ""}
                  {hasWarning && (
                    <span className="text-warning ml-1">
                      · {[warnInactive && "cor inativa no estoque", warnNoStock && "sem estoque", warnNoImages && "sem imagem"].filter(Boolean).join(", ")}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => moveColor(c.localId, -1)} disabled={i === 0} className="text-muted hover:text-dark-text disabled:opacity-30 p-1" title="Mover para cima">
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => moveColor(c.localId, 1)} disabled={i === colors.length - 1} className="text-muted hover:text-dark-text disabled:opacity-30 p-1" title="Mover para baixo">
                  <ChevronDown size={14} />
                </button>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setExpandedId(c.localId)}>
                Editar
              </Button>
              <button onClick={() => removeColor(c.localId)} className="text-muted hover:text-danger transition-colors p-1.5" title="Remover cor do produto">
                <Trash2 size={14} />
              </button>
            </div>
          );
        }

        return (
          <div key={c.localId} className="border border-accent/30 rounded-2xl p-4 space-y-4 bg-dark-alt/30">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full border border-dark-border-light flex-shrink-0" style={{ backgroundColor: variant.color_hex }} />
                <span className="text-sm font-semibold text-dark-text">{variant.color_name}</span>
                <span className="text-xs text-muted">· {colorStock(variant)} un. · tamanhos {colorSizes(variant) || "—"}</span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setMain(c.localId)}
                  className={["flex items-center gap-1 text-xs transition-colors", c.isMain ? "text-accent" : "text-muted hover:text-dark-text"].join(" ")}
                >
                  <Crown size={13} />
                  {c.isMain ? "Cor principal" : "Tornar principal"}
                </button>
                <button onClick={() => removeColor(c.localId)} className="flex items-center gap-1 text-xs text-danger hover:text-danger/80 transition-colors">
                  <Trash2 size={13} />
                  Remover cor
                </button>
                <Button type="button" variant="accent" size="sm" onClick={() => setExpandedId(null)}>
                  Concluído
                </Button>
              </div>
            </div>

            {hasWarning && (
              <div className="flex items-start gap-1.5 text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg p-2">
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                <span>
                  {[
                    warnInactive && "Esta cor está inativa no Estoque — não aparecerá no site.",
                    warnNoStock && "Sem estoque em nenhum tamanho.",
                    warnNoImages && "Nenhuma imagem cadastrada para esta cor.",
                  ].filter(Boolean).join(" ")}
                </span>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-dark-text mb-1.5">Imagens desta cor no produto</p>
              <ColorImageUploader
                mediaFolderId={productId}
                images={c.images}
                onChange={(images) => updateColorImages(c.localId, images)}
              />
              <p className="text-[11px] text-muted mt-1.5">
                Importadas do Estoque por padrão — adicione, reordene ou remova só neste produto, sem afetar o Estoque.
              </p>
            </div>
          </div>
        );
      })}

      {availableToAdd.length > 0 ? (
        <AddColorPicker options={availableToAdd} onPick={addColor} />
      ) : (
        colors.length > 0 && (
          <p className="text-xs text-muted">Todas as cores da peça vinculada já foram adicionadas a este produto.</p>
        )
      )}
    </div>
  );
}
