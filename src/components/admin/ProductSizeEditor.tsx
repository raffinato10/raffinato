"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Wand2, X } from "lucide-react";
import { Toggle } from "@/components/common/Toggle";
import { generateSizeSku } from "@/lib/sku";
import type { ProductVariantSize } from "@/types";

// ---------------------------------------------------------------------------
// Editor de tamanhos SEM cor — pro produto manual "tamanho único" (a grande
// maioria de roupa simples: P/M/G/GG com estoque próprio, sem variação de
// cor). Por baixo dos panos isso ainda salva como 1 product_variants (cor
// neutra, nunca exibida) + N product_variant_sizes — mesma estrutura que já
// alimenta carrinho/checkout/listagem/PDP — só a UI aqui é mais simples,
// sem pedir nome de cor nem foto por cor (usa a "Foto principal" do produto).
// ---------------------------------------------------------------------------

const SIZE_PRESETS = ["PP", "P", "M", "G", "GG", "G1", "G2", "G3", "XG", "Único"];
const CUSTOM_SIZE_VALUE = "__custom__";

interface SizeRow {
  localId: string;
  dbId?: string;
  size: string;
  useCustomSize: boolean;
  stock: string;
  sku: string;
  isActive: boolean;
}

export interface SimpleSizeInput {
  dbId?: string;
  size: string;
  stock: number;
  sku?: string;
  is_active: boolean;
}

function emptyRow(): SizeRow {
  return {
    localId: `size-${Date.now()}-${Math.random()}`,
    size: "",
    useCustomSize: false,
    stock: "0",
    sku: "",
    isActive: true,
  };
}

function toSimpleSizeInputs(rows: SizeRow[]): SimpleSizeInput[] {
  return rows
    .filter((r) => r.size.trim())
    .map((r) => ({
      dbId: r.dbId,
      size: r.size.trim(),
      stock: parseInt(r.stock) || 0,
      sku: r.sku.trim() || undefined,
      is_active: r.isActive,
    }));
}

interface Props {
  baseSku?: string;
  initialSizes?: ProductVariantSize[];
  onChange: (sizes: SimpleSizeInput[]) => void;
}

export function ProductSizeEditor({ baseSku, initialSizes = [], onChange }: Props) {
  const [rows, setRows] = useState<SizeRow[]>(() =>
    initialSizes.map((s) => ({
      localId: s.id,
      dbId: s.id,
      size: s.size,
      useCustomSize: !SIZE_PRESETS.includes(s.size.toUpperCase()),
      stock: String(s.stock),
      sku: s.sku ?? "",
      isActive: s.is_active,
    }))
  );

  const notify = useCallback((next: SizeRow[]) => onChange(toSimpleSizeInputs(next)), [onChange]);

  // Notifica o pai no mount, igual ao VariantEditor — necessário pro estado
  // inicial (tamanhos já existentes) ficar disponível pro submit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { notify(rows); }, []);

  const updateRow = (localId: string, patch: Partial<SizeRow>) => {
    const next = rows.map((r) => (r.localId === localId ? { ...r, ...patch } : r));
    setRows(next);
    notify(next);
  };

  const removeRow = (localId: string) => {
    const next = rows.filter((r) => r.localId !== localId);
    setRows(next);
    notify(next);
  };

  const addRow = () => {
    const next = [...rows, emptyRow()];
    setRows(next);
    notify(next);
  };

  const generateSku = (localId: string, sizeOverride?: string) => {
    const row = rows.find((r) => r.localId === localId);
    const size = sizeOverride ?? row?.size;
    if (!row || !size?.trim()) return;
    updateRow(localId, { sku: generateSizeSku(baseSku ?? "SKU", size) });
  };

  const total = rows.reduce((sum, r) => sum + (parseInt(r.stock) || 0), 0);

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="text-xs text-muted">
          Nenhum tamanho cadastrado ainda — sem tamanho, vale o estoque simples (campo abaixo).
        </p>
      )}

      {rows.map((r) => (
        <div key={r.localId} className="flex items-center gap-2 flex-wrap bg-dark-alt/40 rounded-xl p-2.5 border border-dark-border">
          <select
            value={r.useCustomSize ? CUSTOM_SIZE_VALUE : r.size}
            onChange={(e) => {
              const val = e.target.value;
              if (val === CUSTOM_SIZE_VALUE) {
                updateRow(r.localId, { useCustomSize: true, size: "" });
              } else {
                updateRow(r.localId, {
                  useCustomSize: false,
                  size: val,
                  sku: r.sku.trim() || generateSizeSku(baseSku ?? "SKU", val),
                });
              }
            }}
            className="w-28 bg-dark-surface border border-dark-border-light rounded-xl px-2 py-2 text-sm text-dark-text"
          >
            <option value="" disabled>Tamanho</option>
            {SIZE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>{preset}</option>
            ))}
            <option value={CUSTOM_SIZE_VALUE}>Personalizado...</option>
          </select>
          {r.useCustomSize && (
            <input
              type="text"
              value={r.size}
              onChange={(e) => updateRow(r.localId, { size: e.target.value })}
              onBlur={() => { if (!r.sku.trim()) generateSku(r.localId); }}
              placeholder="Ex: 38"
              className="w-20 bg-dark-surface border border-dark-border-light rounded-xl px-3 py-2 text-sm text-dark-text placeholder:text-muted"
              autoFocus
            />
          )}
          <input
            type="number"
            min={0}
            value={r.stock}
            onChange={(e) => updateRow(r.localId, { stock: e.target.value })}
            placeholder="Estoque"
            className="w-24 bg-dark-surface border border-dark-border-light rounded-xl px-3 py-2 text-sm text-dark-text placeholder:text-muted"
          />
          <span className="text-xs text-muted hidden sm:inline">un.</span>
          <input
            type="text"
            value={r.sku}
            onChange={(e) => updateRow(r.localId, { sku: e.target.value })}
            placeholder="SKU (opcional)"
            className="w-40 bg-dark-surface border border-dark-border-light rounded-xl px-3 py-2 text-sm text-dark-text placeholder:text-muted font-mono"
          />
          <button
            onClick={() => generateSku(r.localId)}
            title="Gerar SKU automático"
            className="text-muted hover:text-accent transition-colors p-1.5"
          >
            <Wand2 size={14} />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted whitespace-nowrap">Ativo</span>
            <Toggle size="sm" checked={r.isActive} onChange={(checked) => updateRow(r.localId, { isActive: checked })} />
          </div>
          <button
            onClick={() => removeRow(r.localId)}
            className="ml-auto text-muted hover:text-danger transition-colors p-1"
            title="Remover tamanho"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
      >
        <Plus size={14} />
        Adicionar tamanho
      </button>

      {rows.length > 0 && (
        <p className="text-xs text-muted text-right">Total: {total} unidades</p>
      )}
    </div>
  );
}

