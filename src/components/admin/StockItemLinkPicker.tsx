"use client";

import React, { useEffect, useRef, useState } from "react";
import { Search, Package, X, Loader2 } from "lucide-react";
import { searchStockItemsForLink, getStockItemForLinkPreview } from "@/lib/actions/stock-items";
import type { StockItemSearchResult } from "@/lib/db/stock";
import type { StockItem } from "@/types";

interface Props {
  value: StockItem | null;
  // Ao editar um produto já vinculado, a peça atual deve continuar
  // selecionável mesmo aparecendo como "vinculada" na busca.
  excludeProductId?: string;
  onSelect: (item: StockItem | null) => void;
}

export function StockItemLinkPicker({ value, excludeProductId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockItemSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timer = setTimeout(async () => {
      const result = await searchStockItemsForLink(query);
      if (!("error" in result)) setResults(result);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open]);

  const handlePick = async (id: string) => {
    setOpen(false);
    const item = await getStockItemForLinkPreview(id);
    if (item && !("error" in item)) onSelect(item);
  };

  if (value) {
    const colorNames = value.variants.map((v) => v.color_name);
    const sizeLabels = Array.from(new Set(value.variants.flatMap((v) => v.sizes.map((s) => s.size))));
    const skuCount = value.variants.reduce((sum, v) => sum + v.sizes.length, 0);
    const totalStock = value.variants.reduce((sum, v) => sum + v.sizes.reduce((s, sz) => s + sz.stock, 0), 0);

    return (
      <div className="bg-dark-alt/40 border border-accent/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-accent" />
            <span className="text-sm font-semibold text-dark-text">Peça vinculada: {value.name}</span>
          </div>
          <button
            onClick={() => onSelect(null)}
            className="text-muted hover:text-danger transition-colors p-1"
            title="Remover vínculo"
          >
            <X size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-muted">Cores</p>
            <p className="text-dark-text font-medium">{colorNames.join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-muted">Tamanhos</p>
            <p className="text-dark-text font-medium">{sizeLabels.join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-muted">SKUs</p>
            <p className="text-dark-text font-medium">{skuCount} variações</p>
          </div>
          <div>
            <p className="text-muted">Estoque total</p>
            <p className="text-dark-text font-medium">{totalStock} unidades</p>
          </div>
        </div>
        <p className="text-[11px] text-muted">
          As imagens, cores, tamanhos e estoque deste produto vêm desta peça — gerencie tudo isso em Estoque.
        </p>
      </div>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Buscar peça no estoque por nome ou SKU..."
          className="w-full bg-dark-surface border border-dark-border-light rounded-xl pl-9 pr-9 py-2.5 text-sm text-dark-text placeholder-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
        />
        {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted animate-spin" />}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-dark-surface border border-dark-border-light rounded-xl shadow-xl max-h-72 overflow-y-auto">
          {results.length === 0 && !loading && (
            <p className="text-xs text-muted text-center py-4">Nenhuma peça encontrada.</p>
          )}
          {results.map((r) => {
            const linkedElsewhere = r.linkedProductId && r.linkedProductId !== excludeProductId;
            return (
              <button
                key={r.id}
                type="button"
                disabled={!!linkedElsewhere}
                onClick={() => handlePick(r.id)}
                className={[
                  "w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 transition-colors",
                  linkedElsewhere ? "opacity-40 cursor-not-allowed" : "hover:bg-dark-hover cursor-pointer",
                ].join(" ")}
              >
                <div>
                  <p className="text-sm text-dark-text font-medium">{r.name}</p>
                  <p className="text-xs text-muted font-mono">{r.base_sku} · {r.colorCount} cores · {r.skuCount} SKUs · {r.totalStock} un.</p>
                </div>
                {linkedElsewhere && <span className="text-[10px] text-muted whitespace-nowrap">já vinculada</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
