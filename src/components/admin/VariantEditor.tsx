"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Upload, X, Star, Sun, ImageIcon, Loader2, AlertCircle, Plus, Trash2, Wand2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import { Toggle } from "@/components/common/Toggle";
import { generateVariantSku } from "@/lib/sku";
import { extractDroppedImageUrl } from "@/lib/drag-image-url";
import type { ProductVariant } from "@/types";
import type { VariantInput, VariantMediaInput, VariantSizeInput } from "@/lib/actions/variants";

// ---------------------------------------------------------------------------
// Tipos de estado local (UI) — convertidos para VariantInput no onChange
// ---------------------------------------------------------------------------

interface MediaItem {
  localId: string;
  dbId?: string;
  url: string;
  storagePath?: string;
  is_main: boolean;
  is_hover: boolean;
  display_order: number;
  uploading: boolean;
  uploadError?: string;
}

interface SizeItem {
  localId: string;
  dbId?: string;
  size: string;
  useCustomSize: boolean; // true = campo de texto livre em vez do select
  stock: string;      // texto no input, convertido pra número no onChange
  sku: string;
  lowStockAlert: string;
  isActive: boolean;
}

// Tamanhos mais comuns de roupa — aparecem como opções no select. "Personalizado"
// abre um campo de texto livre pra qualquer outro valor (ex: numeração 38/40/42).
const SIZE_PRESETS = ["PP", "P", "M", "G", "GG", "G1", "G2", "G3", "XG", "Único"];
const CUSTOM_SIZE_VALUE = "__custom__";

interface VariantItem {
  localId: string;
  dbId?: string;
  color_name: string;
  color_hex: string;
  display_order: number;
  isActive: boolean;
  media: MediaItem[];
  sizes: SizeItem[];
}

const MAX_IMAGES = 5;

function extractStoragePath(url: string): string | undefined {
  const marker = "/storage/v1/object/public/product-images/";
  const idx = url.indexOf(marker);
  if (idx === -1) return undefined;
  return url.slice(idx + marker.length);
}

function emptySize(): SizeItem {
  return {
    localId: `size-${Date.now()}-${Math.random()}`,
    size: "",
    useCustomSize: false,
    stock: "0",
    sku: "",
    lowStockAlert: "5",
    isActive: true,
  };
}

function emptyVariant(displayOrder: number): VariantItem {
  return {
    localId: `variant-${Date.now()}-${Math.random()}`,
    color_name: "",
    color_hex: "#000000",
    display_order: displayOrder,
    isActive: true,
    media: [],
    sizes: [emptySize()],
  };
}

function toVariantInputs(variants: VariantItem[]): VariantInput[] {
  return variants.map((v, i) => ({
    dbId: v.dbId,
    color_name: v.color_name,
    color_hex: v.color_hex,
    display_order: i,
    is_active: v.isActive,
    media: v.media.map((m): VariantMediaInput => ({
      dbId: m.dbId,
      url: m.url,
      storagePath: m.storagePath,
      is_main: m.is_main,
      is_hover: m.is_hover,
      display_order: m.display_order,
      uploadError: m.uploadError,
    })),
    sizes: v.sizes
      .filter((s) => s.size.trim())
      .map((s): VariantSizeInput => ({
        dbId: s.dbId,
        size: s.size,
        stock: parseInt(s.stock) || 0,
        sku: s.sku.trim() || undefined,
        low_stock_alert: parseInt(s.lowStockAlert) || 5,
        is_active: s.isActive,
      })),
  }));
}

// ---------------------------------------------------------------------------
// Upload de imagens de UMA cor — versão simplificada do MediaUploader, sem
// campo de vídeo (não se aplica por cor) e com um toggle explícito de imagem
// de hover (independente da posição, ao contrário de is_main).
// ---------------------------------------------------------------------------

function VariantImageUploader({
  mediaFolderId,
  media,
  onChange,
}: {
  mediaFolderId: string;
  media: MediaItem[];
  onChange: (next: MediaItem[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const uploadFile = async (file: File) => {
    const localId = `local-${Date.now()}-${Math.random()}`;
    const pending: MediaItem = {
      localId,
      url: URL.createObjectURL(file),
      is_main: media.length === 0,
      is_hover: false,
      display_order: media.length,
      uploading: true,
    };
    onChange([...media, pending]);

    const form = new FormData();
    form.append("file", file);
    form.append("productId", mediaFolderId);

    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const json = await res.json();

      if (!res.ok) {
        onChange(
          [...media, pending].map((it) =>
            it.localId === localId
              ? { ...it, uploading: false, uploadError: json.error ?? "Erro no upload" }
              : it
          )
        );
        return;
      }

      onChange(
        [...media, pending].map((it) =>
          it.localId === localId
            ? { ...it, url: json.url, storagePath: json.storagePath, uploading: false, uploadError: undefined }
            : it
        )
      );
    } catch {
      onChange(
        [...media, pending].map((it) =>
          it.localId === localId ? { ...it, uploading: false, uploadError: "Falha na conexão" } : it
        )
      );
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const slots = MAX_IMAGES - media.length;
    if (slots <= 0) return;
    Array.from(files).slice(0, slots).forEach((file) => uploadFile(file));
  };

  // Arrastado de outra aba/site (Pinterest, Google Imagens, etc.) — o
  // navegador só entrega o link da imagem, nunca o arquivo em si.
  const uploadFromUrl = async (url: string) => {
    if (media.length >= MAX_IMAGES) return;
    const localId = `local-${Date.now()}-${Math.random()}`;
    const pending: MediaItem = {
      localId,
      url,
      is_main: media.length === 0,
      is_hover: false,
      display_order: media.length,
      uploading: true,
    };
    onChange([...media, pending]);

    try {
      const res = await fetch("/api/admin/upload-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, productId: mediaFolderId }),
      });
      const json = await res.json();

      onChange(
        [...media, pending].map((it) =>
          it.localId === localId
            ? !res.ok
              ? { ...it, uploading: false, uploadError: json.error ?? "Erro ao baixar imagem" }
              : { ...it, url: json.url, storagePath: json.storagePath, uploading: false, uploadError: undefined }
            : it
        )
      );
    } catch {
      onChange(
        [...media, pending].map((it) =>
          it.localId === localId ? { ...it, uploading: false, uploadError: "Falha na conexão" } : it
        )
      );
    }
  };

  const removeItem = async (item: MediaItem) => {
    if (item.uploading) return;
    if (!item.dbId && item.storagePath) {
      await fetch(`/api/admin/upload?path=${encodeURIComponent(item.storagePath)}`, { method: "DELETE" });
    }
    const next = media
      .filter((m) => m.localId !== item.localId)
      .map((m, i) => ({ ...m, display_order: i, is_main: i === 0 }));
    onChange(next);
  };

  const setHover = (item: MediaItem) => {
    onChange(media.map((m) => ({ ...m, is_hover: m.localId === item.localId ? !m.is_hover : false })));
  };

  // A imagem principal é sempre a da posição 0 (mesma convenção de
  // removeItem acima) — mover reordena e recalcula quem fica em primeiro.
  const move = (item: MediaItem, dir: -1 | 1) => {
    const idx = media.findIndex((m) => m.localId === item.localId);
    const swapIdx = idx + dir;
    if (idx === -1 || swapIdx < 0 || swapIdx >= media.length) return;
    const next = media.slice();
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    onChange(next.map((m, i) => ({ ...m, display_order: i, is_main: i === 0 })));
  };

  const canAdd = media.length < MAX_IMAGES;

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
            Arraste ou clique para enviar fotos desta cor · {media.length}/{MAX_IMAGES}
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

      {media.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {media.map((item, i) => (
            <div
              key={item.localId}
              className="relative group aspect-square bg-dark-alt rounded-lg overflow-hidden border border-dark-border"
            >
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
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex flex-col justify-between p-1">
                  <div className="flex justify-between">
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => move(item, -1)}
                        disabled={i === 0}
                        className="w-5 h-5 bg-black/60 rounded flex items-center justify-center hover:bg-black/80 disabled:opacity-30"
                        title="Mover antes"
                      >
                        <ChevronLeft size={11} className="text-white" />
                      </button>
                      <button
                        onClick={() => move(item, 1)}
                        disabled={i === media.length - 1}
                        className="w-5 h-5 bg-black/60 rounded flex items-center justify-center hover:bg-black/80 disabled:opacity-30"
                        title="Mover depois"
                      >
                        <ChevronRight size={11} className="text-white" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item)}
                      className="w-5 h-5 bg-danger rounded flex items-center justify-center hover:bg-danger/80"
                      title="Remover"
                    >
                      <X size={11} className="text-white" />
                    </button>
                  </div>
                  <button
                    onClick={() => setHover(item)}
                    className={[
                      "flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium",
                      item.is_hover ? "bg-accent text-dark-bg" : "bg-black/60 text-white hover:bg-black/80",
                    ].join(" ")}
                    title="Marcar como imagem de hover (mostrada ao passar o mouse no card)"
                  >
                    <Sun size={10} />
                    Hover
                  </button>
                </div>
              )}

              {i === 0 && !item.uploading && !item.uploadError && (
                <div className="absolute top-1 left-1 bg-black/60 rounded px-1 py-0.5 pointer-events-none">
                  <Star size={10} className="text-accent fill-accent" />
                </div>
              )}
              {item.is_hover && !item.uploading && !item.uploadError && (
                <div className="absolute bottom-0 left-0 right-0 py-0.5 bg-accent/90 text-center pointer-events-none">
                  <span className="text-[10px] text-dark-bg font-semibold">Hover</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {media.length === 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <ImageIcon size={12} />
          Nenhuma imagem ainda — a primeira enviada é a principal.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal — lista de cores
// ---------------------------------------------------------------------------

interface Props {
  // Pasta no Storage onde as fotos de cada cor são salvas (productId — só
  // usado como prefixo do caminho, sem efeito no banco).
  mediaFolderId: string;
  // SKU base do produto — usado pra sugerir o SKU automático de cada
  // tamanho (ex: "CAM-BAS" + cor + tamanho = "CAM-BAS-PRE-M").
  baseSku?: string;
  initialVariants?: ProductVariant[];
  onChange: (variants: VariantInput[], removedVariantIds: string[]) => void;
}

export function VariantEditor({ mediaFolderId, baseSku, initialVariants = [], onChange }: Props) {
  const [variants, setVariants] = useState<VariantItem[]>(() =>
    initialVariants.map((v, i) => ({
      localId: v.id,
      dbId: v.id,
      color_name: v.color_name,
      color_hex: v.color_hex,
      display_order: i,
      isActive: v.is_active,
      media: v.media.map((m) => ({
        localId: m.id,
        dbId: m.id,
        url: m.url,
        storagePath: m.storage_path ?? extractStoragePath(m.url),
        is_main: m.is_main,
        is_hover: m.is_hover,
        display_order: m.display_order,
        uploading: false,
      })),
      sizes: v.sizes.map((s) => ({
        localId: s.id,
        dbId: s.id,
        size: s.size,
        useCustomSize: !SIZE_PRESETS.includes(s.size.toUpperCase()),
        stock: String(s.stock),
        sku: s.sku ?? "",
        lowStockAlert: String(s.low_stock_alert ?? 5),
        isActive: s.is_active,
      })),
    }))
  );
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);
  // Cor atualmente aberta para edição — todas as outras ficam recolhidas
  // numa linha compacta (swatch + nome + total). null = todas recolhidas.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const notify = useCallback(
    (nextVariants: VariantItem[], nextRemoved: string[]) => {
      onChange(toVariantInputs(nextVariants), nextRemoved);
    },
    [onChange]
  );

  // Notifica o pai logo no mount, igual ao MediaUploader — necessário pro
  // estado inicial (variações já existentes) ficar disponível pro submit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { notify(variants, removedVariantIds); }, []);

  // Sem isso, soltar o arquivo um pixel fora da área exata de uma das fotos
  // de cor faz o navegador abrir a imagem direto (navegando pra fora da
  // página) em vez de só ignorar o drop.
  useEffect(() => {
    const preventDefault = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);
    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  const updateVariant = (localId: string, patch: Partial<VariantItem>) => {
    const next = variants.map((v) => (v.localId === localId ? { ...v, ...patch } : v));
    setVariants(next);
    notify(next, removedVariantIds);
  };


  const removeVariant = (localId: string) => {
    const target = variants.find((v) => v.localId === localId);
    const next = variants.filter((v) => v.localId !== localId);
    const nextRemoved = target?.dbId ? [...removedVariantIds, target.dbId] : removedVariantIds;
    setVariants(next);
    setRemovedVariantIds(nextRemoved);
    notify(next, nextRemoved);
    setExpandedId((current) => (current === localId ? null : current));
  };

  const addSize = (variantLocalId: string) => {
    const v = variants.find((v) => v.localId === variantLocalId);
    if (!v) return;
    updateVariant(variantLocalId, { sizes: [...v.sizes, emptySize()] });
  };

  const removeSize = (variantLocalId: string, sizeLocalId: string) => {
    const v = variants.find((v) => v.localId === variantLocalId);
    if (!v) return;
    updateVariant(variantLocalId, { sizes: v.sizes.filter((s) => s.localId !== sizeLocalId) });
  };

  const updateSize = (variantLocalId: string, sizeLocalId: string, patch: Partial<SizeItem>) => {
    const v = variants.find((v) => v.localId === variantLocalId);
    if (!v) return;
    updateVariant(variantLocalId, {
      sizes: v.sizes.map((s) => (s.localId === sizeLocalId ? { ...s, ...patch } : s)),
    });
  };

  const generateSku = (
    variantLocalId: string,
    sizeLocalId: string,
    opts?: { onlyIfEmpty?: boolean }
  ) => {
    const v = variants.find((v) => v.localId === variantLocalId);
    const s = v?.sizes.find((s) => s.localId === sizeLocalId);
    if (!v || !s || !s.size.trim()) return;
    if (opts?.onlyIfEmpty && s.sku.trim()) return;
    updateSize(variantLocalId, sizeLocalId, {
      sku: generateVariantSku(baseSku ?? "SKU", v.color_name || "Cor", s.size),
    });
  };

  // Total de unidades desta cor — soma de todos os tamanhos
  const colorTotal = (v: VariantItem) =>
    v.sizes.reduce((sum, s) => sum + (parseInt(s.stock) || 0), 0);

  const handleAddVariant = () => {
    const next = emptyVariant(variants.length);
    setVariants([...variants, next]);
    notify([...variants, next], removedVariantIds);
    setExpandedId(next.localId);
  };

  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" leftIcon={<Plus size={14} />} onClick={handleAddVariant}>
        Adicionar nova cor
      </Button>

      {variants.length === 0 && (
        <p className="text-xs text-muted">
          Nenhuma cor cadastrada ainda — sem cor, vale o estoque simples (campo abaixo, se houver).
        </p>
      )}

      {variants.map((v, vi) => {
        const isExpanded = expandedId === v.localId;

        if (!isExpanded) {
          return (
            <div
              key={v.localId}
              className="flex items-center gap-3 border border-dark-border rounded-xl p-3 bg-dark-alt/30"
            >
              <span
                className="w-8 h-8 rounded-full border border-dark-border-light flex-shrink-0"
                style={{ backgroundColor: v.color_hex }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dark-text truncate">
                  {v.color_name || `Cor ${vi + 1} (sem nome)`}
                  {!v.isActive && <span className="text-muted font-normal"> · inativa</span>}
                </p>
                <p className="text-xs text-muted">
                  {colorTotal(v)} un. · {v.sizes.length} tamanho{v.sizes.length !== 1 ? "s" : ""} · {v.media.length} foto{v.media.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setExpandedId(v.localId)}>
                Editar
              </Button>
              <button
                onClick={() => removeVariant(v.localId)}
                className="text-muted hover:text-danger transition-colors p-1.5"
                title="Remover cor"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        }

        return (
        <div key={v.localId} className="border border-accent/30 rounded-2xl p-4 space-y-4 bg-dark-alt/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Cor {vi + 1} · {colorTotal(v)} un. no total
            </span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Ativa</span>
                <Toggle size="sm" checked={v.isActive} onChange={(checked) => updateVariant(v.localId, { isActive: checked })} />
              </div>
              <button
                onClick={() => removeVariant(v.localId)}
                className="flex items-center gap-1 text-xs text-danger hover:text-danger/80 transition-colors"
              >
                <Trash2 size={13} />
                Remover cor
              </button>
              <Button type="button" variant="accent" size="sm" onClick={() => setExpandedId(null)}>
                Concluir
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <Input
              label="Nome da cor"
              value={v.color_name}
              onChange={(e) => updateVariant(v.localId, { color_name: e.target.value })}
              placeholder="Ex: Preto"
            />
            <div>
              <label className="block text-xs font-medium text-dark-text mb-1.5">Cor</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={v.color_hex}
                  onChange={(e) => updateVariant(v.localId, { color_hex: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-dark-border-light cursor-pointer bg-dark-surface"
                />
                <input
                  type="text"
                  value={v.color_hex}
                  onChange={(e) => updateVariant(v.localId, { color_hex: e.target.value })}
                  className="w-24 bg-dark-surface border border-dark-border-light rounded-xl px-2 py-2 text-sm text-dark-text"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-dark-text mb-1.5">Fotos desta cor</p>
            <VariantImageUploader
              mediaFolderId={mediaFolderId}
              media={v.media}
              onChange={(media) => updateVariant(v.localId, { media })}
            />
          </div>

          <div>
            <p className="text-xs font-medium text-dark-text mb-1.5">Tamanhos, SKU e estoque</p>
            <div className="space-y-2">
              {v.sizes.map((s) => (
                <div key={s.localId} className="flex items-center gap-2 flex-wrap bg-dark-surface/50 rounded-xl p-2">
                  <select
                    value={s.useCustomSize ? CUSTOM_SIZE_VALUE : s.size}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === CUSTOM_SIZE_VALUE) {
                        updateSize(v.localId, s.localId, { useCustomSize: true, size: "" });
                      } else {
                        // Preset escolhido de uma vez (não é digitação
                        // caractere a caractere) — já gera o SKU na hora,
                        // sem precisar clicar na varinha. Só não sobrescreve
                        // se o admin já tiver digitado um SKU manualmente.
                        updateSize(v.localId, s.localId, {
                          useCustomSize: false,
                          size: val,
                          sku: s.sku.trim() || generateVariantSku(baseSku ?? "SKU", v.color_name || "Cor", val),
                        });
                      }
                    }}
                    className="w-24 bg-dark-surface border border-dark-border-light rounded-xl px-2 py-2 text-sm text-dark-text"
                  >
                    <option value="" disabled>Tamanho</option>
                    {SIZE_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                    <option value={CUSTOM_SIZE_VALUE}>Personalizado...</option>
                  </select>
                  {s.useCustomSize && (
                    <input
                      type="text"
                      value={s.size}
                      onChange={(e) => updateSize(v.localId, s.localId, { size: e.target.value })}
                      onBlur={() => generateSku(v.localId, s.localId, { onlyIfEmpty: true })}
                      placeholder="Ex: 38"
                      className="w-20 bg-dark-surface border border-dark-border-light rounded-xl px-3 py-2 text-sm text-dark-text placeholder:text-muted"
                      autoFocus
                    />
                  )}
                  <input
                    type="number"
                    min={0}
                    value={s.stock}
                    onChange={(e) => updateSize(v.localId, s.localId, { stock: e.target.value })}
                    placeholder="Estoque"
                    className="w-24 bg-dark-surface border border-dark-border-light rounded-xl px-3 py-2 text-sm text-dark-text placeholder:text-muted"
                  />
                  <span className="text-xs text-muted hidden sm:inline">un.</span>
                  <input
                    type="text"
                    value={s.sku}
                    onChange={(e) => updateSize(v.localId, s.localId, { sku: e.target.value })}
                    placeholder="SKU"
                    className="w-36 bg-dark-surface border border-dark-border-light rounded-xl px-3 py-2 text-sm text-dark-text placeholder:text-muted font-mono"
                  />
                  <button
                    onClick={() => generateSku(v.localId, s.localId)}
                    title="Gerar SKU automático"
                    className="text-muted hover:text-accent transition-colors p-1.5"
                  >
                    <Wand2 size={14} />
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted whitespace-nowrap">Alerta</span>
                    <input
                      type="number"
                      min={0}
                      value={s.lowStockAlert}
                      onChange={(e) => updateSize(v.localId, s.localId, { lowStockAlert: e.target.value })}
                      className="w-14 bg-dark-surface border border-dark-border-light rounded-xl px-2 py-2 text-sm text-dark-text"
                    />
                  </div>
                  <Toggle size="sm" checked={s.isActive} onChange={(checked) => updateSize(v.localId, s.localId, { isActive: checked })} />
                  <button
                    onClick={() => removeSize(v.localId, s.localId)}
                    className="ml-auto text-muted hover:text-danger transition-colors p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => addSize(v.localId)}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors mt-2"
            >
              <Plus size={13} />
              Adicionar tamanho
            </button>
          </div>
        </div>
        );
      })}

      {variants.length > 0 && (
        <p className="text-xs text-muted text-right">
          Total geral: {variants.reduce((sum, v) => sum + colorTotal(v), 0)} unidades
        </p>
      )}
    </div>
  );
}
