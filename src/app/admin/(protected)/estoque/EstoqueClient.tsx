"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Boxes, Pencil, ShoppingBag, Plus, Trash2, AlertTriangle } from "lucide-react";
import { SearchInput } from "@/components/common/SearchInput";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { Toggle } from "@/components/common/Toggle";
import { Tabs, TabContent } from "@/components/common/Tabs";
import { VariantEditor } from "@/components/admin/VariantEditor";
import { saveVariants, type VariantInput } from "@/lib/actions/variants";
import { updateProductStock } from "@/lib/actions/products";
import { createStockItem, updateStockItem, getStockItemHistory, deleteStockItem } from "@/lib/actions/stock-items";
import { formatDateTime } from "@/lib/formatters";
import type { AdminProduct } from "@/lib/db/admin";
import type { StockItem, InventoryMovement, InventoryMovementType } from "@/types";

interface EstoqueClientProps {
  stockItems: StockItem[];
  legacyProducts: AdminProduct[];
  categoryOptions: { value: string; label: string }[];
}

// ---------------------------------------------------------------------------
// Linha unificada — uma "peça" (stock_items) ou um "produto" legado (sem
// peça vinculada, estoque flat ou variantes próprias antigas)
// ---------------------------------------------------------------------------

interface Row {
  kind: "stock_item" | "product";
  id: string;
  name: string;
  sku: string;
  isActive: boolean;
  colorCount: number;
  skuCount: number;
  totalStock: number;
  linkedProductName?: string;
  stockItem?: StockItem;
  product?: AdminProduct;
}

function totalStockOfVariants(variants: { sizes: { stock: number }[] }[]): number {
  return variants.reduce((sum, v) => sum + v.sizes.reduce((s, sz) => s + sz.stock, 0), 0);
}

function toRows(stockItems: StockItem[], legacyProducts: AdminProduct[]): Row[] {
  const stockRows: Row[] = stockItems.map((s) => ({
    kind: "stock_item",
    id: s.id,
    name: s.name,
    sku: s.base_sku,
    isActive: s.is_active,
    colorCount: s.variants.length,
    skuCount: s.variants.reduce((sum, v) => sum + v.sizes.length, 0),
    totalStock: totalStockOfVariants(s.variants),
    linkedProductName: s.linked_product?.name,
    stockItem: s,
  }));

  const productRows: Row[] = legacyProducts.map((p) => {
    const hasVariants = (p.variants?.length ?? 0) > 0;
    return {
      kind: "product",
      id: p.id,
      name: p.name,
      sku: p.sku,
      isActive: p.is_active,
      colorCount: hasVariants ? p.variants!.length : 0,
      skuCount: hasVariants ? p.variants!.reduce((sum, v) => sum + v.sizes.length, 0) : 1,
      totalStock: hasVariants ? totalStockOfVariants(p.variants!) : p.stock ?? 0,
      product: p,
    };
  });

  return [...stockRows, ...productRows].sort((a, b) => a.name.localeCompare(b.name));
}

function StockBadge({ total, isActive }: { total: number; isActive: boolean }) {
  if (!isActive) return <Badge label="Inativo" variant="neutral" size="sm" />;
  if (total === 0) return <Badge label="Sem estoque" variant="danger" size="sm" />;
  if (total <= 3) return <Badge label="Crítico" variant="danger" size="sm" />;
  if (total <= 10) return <Badge label="Baixo" variant="warning" size="sm" />;
  return <Badge label="Ok" variant="success" size="sm" />;
}

export function EstoqueClient({ stockItems, legacyProducts, categoryOptions }: EstoqueClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [creatingStockItem, setCreatingStockItem] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const rows = useMemo(() => toRows(stockItems, legacyProducts), [stockItems, legacyProducts]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(term) || r.sku.toLowerCase().includes(term));
  }, [rows, search]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-dark-text flex items-center gap-2">
            <Boxes size={22} className="text-accent" />
            Estoque
          </h1>
          <p className="text-sm text-muted mt-1">
            Peças com cor, tamanho, SKU e quantidade — base real do que existe na loja.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SearchInput
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={setSearch}
            className="w-full sm:w-72"
          />
          <Button variant="accent" size="sm" leftIcon={<Plus size={14} />} onClick={() => setCreatingStockItem(true)}>
            Criar peça
          </Button>
        </div>
      </div>

      <div className="bg-dark-surface border border-dark-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-border text-left text-xs text-muted uppercase tracking-wider">
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Cores</th>
              <th className="px-4 py-3 font-semibold">SKUs</th>
              <th className="px-4 py-3 font-semibold">Estoque total</th>
              <th className="px-4 py-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const thumb =
                row.stockItem?.variants[0]?.media.find((m) => m.is_main)?.url ??
                row.stockItem?.variants[0]?.media[0]?.url ??
                row.product?.variants?.[0]?.media.find((m) => m.is_main)?.url ??
                row.product?.media?.find((m) => m.is_main)?.url;

              return (
                <tr key={`${row.kind}-${row.id}`} className="border-b border-dark-border last:border-0 hover:bg-dark-alt/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-lg bg-dark-alt border border-dark-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {thumb ? (
                          <Image src={thumb} alt={row.name} width={44} height={44} className="object-cover w-full h-full" unoptimized />
                        ) : (
                          <ShoppingBag size={18} className="text-muted" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-dark-text">{row.name}</p>
                        <p className="text-xs text-muted font-mono">{row.sku}</p>
                        {row.linkedProductName && (
                          <p className="text-[11px] text-accent/80">Produto: {row.linkedProductName}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      label={row.kind === "stock_item" ? "Peça" : "Produto"}
                      variant={row.kind === "stock_item" ? "gold" : "neutral"}
                      size="sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-dark-text">{row.colorCount || "—"}</td>
                  <td className="px-4 py-3 text-dark-text">{row.skuCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StockBadge total={row.totalStock} isActive={row.isActive} />
                      <span className="text-muted text-xs">{row.totalStock} un.</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingRow(row)} leftIcon={<Pencil size={13} />}>
                        Editar estoque
                      </Button>
                      {row.kind === "stock_item" && (
                        <button
                          onClick={() => setDeleteTarget(row)}
                          className="text-muted hover:text-danger transition-colors p-2 rounded-lg hover:bg-danger/10"
                          title="Excluir peça"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredRows.length === 0 && (
          <div className="py-12 text-center text-sm text-muted">Nenhuma peça ou produto encontrado.</div>
        )}
      </div>

      {editingRow && (
        <EstoqueEditModal
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={() => {
            setEditingRow(null);
            router.refresh();
          }}
        />
      )}

      {creatingStockItem && (
        <StockItemFormModal
          categoryOptions={categoryOptions}
          onClose={() => setCreatingStockItem(false)}
          onSaved={() => {
            setCreatingStockItem(false);
            router.refresh();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteStockItemModal
          row={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de confirmação para excluir uma peça do estoque — ação irreversível
// (apaga cores, tamanhos, SKUs e imagens da peça), por isso pede confirmação
// explícita em vez do confirm() nativo do navegador.
// ---------------------------------------------------------------------------

function DeleteStockItemModal({
  row,
  onClose,
  onDeleted,
}: {
  row: Row;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setError("");
    setDeleting(true);
    const result = await deleteStockItem(row.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDeleted();
  };

  return (
    <Modal isOpen onClose={onClose} size="sm">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-danger/15 flex items-center justify-center">
          <Trash2 size={26} className="text-danger" />
        </div>
        <div>
          <h3 className="text-base font-bold text-dark-text">Excluir peça do estoque?</h3>
          <p className="text-sm text-muted mt-1.5 leading-relaxed">
            Você está prestes a excluir <strong className="text-dark-text">{row.name}</strong>{" "}
            <span className="font-mono text-xs">({row.sku})</span>. Todas as cores, tamanhos, SKUs e
            imagens desta peça serão apagados permanentemente.
          </p>
          <div className="flex items-start gap-2 mt-3 p-2.5 rounded-xl bg-warning/10 border border-warning/20 text-left">
            <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-warning">Esta ação não pode ser desfeita.</p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 w-full">
            {error}
          </p>
        )}

        <div className="flex gap-3 w-full mt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleConfirm} isLoading={deleting}>
            Excluir peça
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modal "Criar peça" — dados básicos da peça (sem variações ainda; cores e
// tamanhos são adicionados depois, em "Editar estoque").
// ---------------------------------------------------------------------------

function StockItemFormModal({
  categoryOptions,
  onClose,
  onSaved,
}: {
  categoryOptions: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [baseSku, setBaseSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    setSaving(true);
    const result = await createStockItem({ name, base_sku: baseSku, category_id: categoryId || null, is_active: isActive });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Criar peça"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="accent" onClick={handleSave} isLoading={saving}>Criar</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        <Input label="Nome da peça" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Camisa Básica" />
        <Input
          label="SKU base"
          value={baseSku}
          onChange={(e) => setBaseSku(e.target.value.toUpperCase())}
          placeholder="Ex: CAM-BAS"
        />
        <Select
          label="Categoria (opcional)"
          value={categoryId}
          onChange={setCategoryId}
          options={categoryOptions}
          placeholder="Sem categoria"
        />
        <div className="flex items-center gap-2">
          <Toggle checked={isActive} onChange={setIsActive} />
          <span className="text-sm text-dark-text">Ativa</span>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modal "Editar estoque" — VariantEditor pra peças e produtos com variação,
// campo simples de estoque pra produtos legados sem cor/tamanho.
// ---------------------------------------------------------------------------

const MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  sale: "Venda",
  restock: "Entrada",
  adjustment: "Ajuste",
  cancelled_return: "Devolução (cancelamento)",
};

function MovementHistory({ stockItemId }: { stockItemId: string }) {
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [error, setError] = useState("");

  React.useEffect(() => {
    let cancelled = false;
    getStockItemHistory(stockItemId).then((result) => {
      if (cancelled) return;
      if (Array.isArray(result)) setMovements(result);
      else setError(result.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [stockItemId]);

  if (loading) return <p className="text-sm text-muted py-6 text-center">Carregando histórico...</p>;
  if (error) return <p className="text-sm text-danger py-6 text-center">{error}</p>;
  if (movements.length === 0) return <p className="text-sm text-muted py-6 text-center">Nenhuma movimentação registrada ainda.</p>;

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {movements.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-3 bg-dark-alt/40 rounded-xl px-3 py-2.5 text-sm">
          <div>
            <p className="text-dark-text font-medium">
              {MOVEMENT_LABELS[m.type]}
              {m.color_name && m.size && <span className="text-muted"> · {m.color_name} / {m.size}</span>}
            </p>
            <p className="text-xs text-muted">{formatDateTime(m.created_at)} · {m.created_by}</p>
          </div>
          <div className="text-right">
            <p className={m.quantity_change < 0 ? "text-danger font-semibold" : "text-success font-semibold"}>
              {m.quantity_change > 0 ? "+" : ""}{m.quantity_change}
            </p>
            <p className="text-xs text-muted">{m.quantity_before} → {m.quantity_after}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function EstoqueEditModal({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState("variacoes");
  const [variants, setVariants] = useState<VariantInput[]>([]);
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);
  const [flatStock, setFlatStock] = useState(String(row.product?.stock ?? 0));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const isStockItem = row.kind === "stock_item";
  const ownerId = isStockItem ? row.stockItem!.id : row.product!.id;
  const baseSku = isStockItem ? row.stockItem!.base_sku : row.product!.sku;
  const initialVariants = isStockItem ? row.stockItem!.variants : row.product!.variants;

  const handleSave = async () => {
    setError("");
    setSaved(false);
    setSaving(true);

    const owner = isStockItem
      ? { type: "stock_item" as const, id: ownerId, baseSku }
      : { type: "product" as const, id: ownerId, baseSku };

    const variantsResult = await saveVariants(owner, variants, removedVariantIds);
    if (variantsResult.error) {
      setSaving(false);
      setError(variantsResult.error);
      return;
    }

    // Só atualiza o estoque flat se o produto NÃO tiver nenhuma cor/tamanho
    // cadastrado — com variação, o estoque real vem de product_variant_sizes
    // e esse campo simples nem é exibido no formulário do produto. Chamar
    // isso incondicionalmente sobrescrevia stock=0/disponibilidade="Esgotado"
    // em produtos com variação só porque o campo flat (não usado) ficava 0.
    if (!isStockItem && variants.length === 0) {
      const stockResult = await updateProductStock(ownerId, Number(flatStock) || 0);
      if (stockResult.error) {
        setSaving(false);
        setError(stockResult.error);
        return;
      }
    }

    setSaving(false);
    // Confirmação visível antes de fechar — sem isso, um save bem-sucedido
    // parecia "não fazer nada" (o modal só desaparecia), levando a cliques
    // repetidos e erros de tamanho duplicado na 2ª tentativa.
    setSaved(true);
    setTimeout(() => onSaved(), 700);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Estoque — ${row.name}`}
      size="xl"
      footer={
        <>
          {error && <p className="text-sm text-danger mr-auto">{error}</p>}
          {saved && !error && <p className="text-sm text-success mr-auto">Salvo com sucesso!</p>}
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="accent" onClick={handleSave} isLoading={saving}>Salvar</Button>
        </>
      }
    >
      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {isStockItem ? (
        <Tabs
          variant="pills"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "variacoes", label: "Cores e tamanhos" },
            { value: "historico", label: "Histórico" },
          ]}
        >
          <div className="mt-4">
            <TabContent value="variacoes" active={tab}>
              <VariantEditor
                key={row.stockItem!.updated_at}
                mediaFolderId={ownerId}
                baseSku={baseSku}
                initialVariants={initialVariants}
                onChange={(v, removed) => { setVariants(v); setRemovedVariantIds(removed); }}
              />
            </TabContent>
            <TabContent value="historico" active={tab}>
              <MovementHistory stockItemId={ownerId} />
            </TabContent>
          </div>
        </Tabs>
      ) : (
        <div className="space-y-6">
          <VariantEditor
            key={row.product!.updated_at}
            mediaFolderId={ownerId}
            baseSku={baseSku}
            initialVariants={initialVariants}
            onChange={(v, removed) => { setVariants(v); setRemovedVariantIds(removed); }}
          />

          <div className="pt-4 border-t border-dark-border max-w-xs">
            <Input
              label="Estoque simples (sem cor/tamanho)"
              type="number"
              min={0}
              value={flatStock}
              onChange={(e) => setFlatStock(e.target.value)}
            />
            <p className="text-xs text-muted mt-1.5">
              Só é usado se este produto não tiver nenhuma cor cadastrada acima.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
