"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Save, PackageX, ExternalLink } from "lucide-react";
import { Button } from "@/components/common/Button";
import { SearchInput } from "@/components/common/SearchInput";
import { routes } from "@/lib/routes";
import { updateStockLevels } from "@/lib/actions/stock";
import type { AdminProduct } from "@/lib/db/admin";

interface Props {
  initialProducts: AdminProduct[];
}

// Uma linha por produto: se tem cores, cada cor vira uma sub-linha com um
// input por tamanho (product_variant_sizes.stock); senão, um único input
// de estoque flat (products.stock). O TOTAL é sempre calculado, nunca
// editado diretamente — muda sozinho conforme os inputs abaixo dele.
export function EstoqueClient({ initialProducts }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [sizeEdits, setSizeEdits] = useState<Record<string, string>>({});
  const [flatEdits, setFlatEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          !search ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.sku.toLowerCase().includes(search.toLowerCase())
      ),
    [products, search]
  );

  const dirtyCount = Object.keys(sizeEdits).length + Object.keys(flatEdits).length;

  const getSizeValue = (sizeId: string, original: number) =>
    sizeEdits[sizeId] ?? String(original);

  const getFlatValue = (productId: string, original: number) =>
    flatEdits[productId] ?? String(original);

  const handleSave = async () => {
    setError("");
    setSaved(false);

    const variantSizes: { id: string; stock: number }[] = [];
    for (const [id, value] of Object.entries(sizeEdits)) {
      const stock = parseInt(value, 10);
      if (!Number.isInteger(stock) || stock < 0) {
        setError("Alguma quantidade de tamanho está inválida.");
        return;
      }
      variantSizes.push({ id, stock });
    }

    const flatProducts: { id: string; stock: number; stock_minimum: number }[] = [];
    for (const [id, value] of Object.entries(flatEdits)) {
      const stock = parseInt(value, 10);
      if (!Number.isInteger(stock) || stock < 0) {
        setError("Alguma quantidade de estoque está inválida.");
        return;
      }
      const product = products.find((p) => p.id === id);
      flatProducts.push({ id, stock, stock_minimum: product?.stock_minimum ?? 0 });
    }

    setSaving(true);
    const result = await updateStockLevels({ variantSizes, flatProducts });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    // Aplica os valores salvos no estado local — sem precisar recarregar a página.
    setProducts((prev) =>
      prev.map((p) => {
        const flatEdit = flatEdits[p.id];
        const updatedVariants = p.variants?.map((v) => ({
          ...v,
          sizes: v.sizes.map((s) =>
            sizeEdits[s.id] !== undefined ? { ...s, stock: parseInt(sizeEdits[s.id], 10) } : s
          ),
        }));
        return {
          ...p,
          stock: flatEdit !== undefined ? parseInt(flatEdit, 10) : p.stock,
          variants: updatedVariants ?? p.variants,
        };
      })
    );
    setSizeEdits({});
    setFlatEdits({});
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Estoque</h1>
          <p className="text-sm text-muted mt-1">
            {filtered.length} produto{filtered.length !== 1 ? "s" : ""} — total e estoque por tamanho de cada peça
          </p>
        </div>
        <Button
          variant="accent"
          leftIcon={<Save size={16} />}
          isLoading={saving}
          disabled={dirtyCount === 0}
          onClick={handleSave}
        >
          Salvar{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">
          {error}
        </div>
      )}
      {saved && (
        <div className="p-3 bg-success/10 border border-success/20 rounded-xl text-sm text-success">
          Estoque atualizado com sucesso.
        </div>
      )}

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar por nome ou SKU..."
        className="max-w-md"
      />

      <div className="space-y-3">
        {filtered.map((product) => {
          const thumb = product.media?.find((m) => m.type === "image");
          const hasVariants = (product.variants?.length ?? 0) > 0;

          let total = 0;
          if (hasVariants) {
            for (const v of product.variants!) {
              for (const s of v.sizes) {
                if (!s.is_active) continue;
                const value = sizeEdits[s.id];
                total += value !== undefined ? (parseInt(value, 10) || 0) : s.stock;
              }
            }
          } else if (product.track_stock) {
            const value = flatEdits[product.id];
            total = value !== undefined ? (parseInt(value, 10) || 0) : (product.stock ?? 0);
          }

          return (
            <div
              key={product.id}
              className="bg-dark-surface rounded-2xl border border-dark-border p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-lg bg-dark-alt border border-dark-border overflow-hidden flex-shrink-0 relative">
                  {thumb ? (
                    <Image src={thumb.url} alt={product.name} fill className="object-cover" sizes="44px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted">
                      <PackageX size={16} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-dark-text truncate">{product.name}</p>
                  <p className="text-xs text-muted">{product.sku}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-muted">Total</p>
                    <p className="text-base font-bold text-accent">{total}</p>
                  </div>
                  <Link
                    href={routes.admin.editarProduto(product.id)}
                    className="text-muted hover:text-accent transition-colors"
                    title="Abrir produto"
                  >
                    <ExternalLink size={15} />
                  </Link>
                </div>
              </div>

              {hasVariants ? (
                <div className="space-y-2 pl-1">
                  {product.variants!.map((variant) => (
                    <div key={variant.id} className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
                        <span
                          className="w-3 h-3 rounded-full border border-dark-border-light flex-shrink-0"
                          style={{ backgroundColor: variant.color_hex }}
                        />
                        <span className="text-xs text-dark-text truncate">{variant.color_name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {variant.sizes.filter((s) => s.is_active).map((s) => (
                          <label key={s.id} className="flex items-center gap-1.5">
                            <span className="text-xs text-muted w-6 text-right">{s.size}</span>
                            <input
                              type="number"
                              min={0}
                              value={getSizeValue(s.id, s.stock)}
                              onChange={(e) =>
                                setSizeEdits((prev) => ({ ...prev, [s.id]: e.target.value }))
                              }
                              className="w-16 bg-dark-alt border border-dark-border-light rounded-lg px-2 py-1 text-xs text-dark-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                            />
                          </label>
                        ))}
                        {variant.sizes.filter((s) => s.is_active).length === 0 && (
                          <span className="text-xs text-muted">Sem tamanhos ativos</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : product.track_stock ? (
                <div className="flex items-center gap-2 pl-1">
                  <span className="text-xs text-muted">Estoque</span>
                  <input
                    type="number"
                    min={0}
                    value={getFlatValue(product.id, product.stock ?? 0)}
                    onChange={(e) =>
                      setFlatEdits((prev) => ({ ...prev, [product.id]: e.target.value }))
                    }
                    className="w-20 bg-dark-alt border border-dark-border-light rounded-lg px-2 py-1 text-xs text-dark-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              ) : (
                <p className="text-xs text-muted pl-1">
                  Sem controle de estoque — edite no produto pra ativar.
                </p>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <PackageX size={28} className="text-muted mb-3" />
            <p className="text-sm text-muted">Nenhum produto encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
