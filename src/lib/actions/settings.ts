"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import type { ShippingTier } from "@/lib/shipping";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const service = createServiceClient();
  const { data } = await service
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!data) throw new Error("Não autorizado");
}

export async function getShippingTiers(): Promise<ShippingTier[] | { error: string }> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("shipping_tiers")
    .select("min_qty, max_qty, price")
    .order("min_qty", { ascending: true });

  if (error) return { error: "Erro ao carregar faixas de frete." };

  return (data ?? []).map((t) => ({
    min_qty: t.min_qty,
    max_qty: t.max_qty,
    price: Number(t.price),
  }));
}

function validateTiers(tiers: ShippingTier[]): string | null {
  if (tiers.length === 0) return "Adicione ao menos uma faixa de frete.";

  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);

  for (const t of sorted) {
    if (!Number.isInteger(t.min_qty) || t.min_qty < 1) {
      return `Quantidade mínima inválida: ${t.min_qty}.`;
    }
    if (t.max_qty !== null && (!Number.isInteger(t.max_qty) || t.max_qty < t.min_qty)) {
      return `Faixa ${t.min_qty}–${t.max_qty} inválida: o "até" precisa ser maior ou igual ao "de".`;
    }
    if (Number.isNaN(t.price) || t.price < 0) {
      return `Valor de frete inválido na faixa a partir de ${t.min_qty} itens.`;
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.max_qty === null) {
      return `A faixa a partir de ${prev.min_qty} itens não tem limite superior — nenhuma faixa depois dela pode ser aplicada.`;
    }
    if (curr.min_qty <= prev.max_qty) {
      return `Faixas sobrepostas: ${prev.min_qty}–${prev.max_qty} e ${curr.min_qty}–${curr.max_qty ?? "∞"}.`;
    }
  }

  return null;
}

export async function updateShippingTiers(tiers: ShippingTier[]): Promise<{ error?: string }> {
  try {
    await assertAdmin();
  } catch {
    return { error: "Não autorizado." };
  }

  const validationError = validateTiers(tiers);
  if (validationError) return { error: validationError };

  const service = createServiceClient();

  // Substitui tudo — mais simples e seguro que tentar casar id-a-id quando
  // o admin pode adicionar/remover faixas livremente na mesma edição.
  const { error: deleteError } = await service
    .from("shipping_tiers")
    .delete()
    .gte("min_qty", 0);
  if (deleteError) return { error: deleteError.message };

  const { error: insertError } = await service.from("shipping_tiers").insert(
    tiers.map((t) => ({
      min_qty: t.min_qty,
      max_qty: t.max_qty,
      price: t.price,
    }))
  );
  if (insertError) return { error: insertError.message };

  return {};
}
