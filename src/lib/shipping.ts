import type { ShippingOption } from "@/types";

// Frete fixo por faixa de quantidade — mesmo valor para todo o Brasil, sem
// nome de transportadora (o lojista escolhe qual usar só na hora do envio).
// Fonte de verdade: tabela shipping_tiers (editável em Admin > Configurações
// > Frete, quantas faixas o lojista quiser).

export interface ShippingTier {
  min_qty: number;
  max_qty: number | null; // null = sem limite superior
  price: number;
}

export const DEFAULT_SHIPPING_TIERS: ShippingTier[] = [
  { min_qty: 1, max_qty: null, price: 30 },
];

export const FLAT_SHIPPING_CODE = "FLAT";

// Encontra a faixa cujo [min_qty, max_qty] contém itemCount. Se a
// quantidade não cair em nenhuma faixa (ex.: acima da maior faixa
// definida, sem faixa aberta), usa o preço da faixa de maior min_qty —
// o checkout nunca fica sem valor de frete.
export function computeFlatShipping(itemCount: number, tiers: ShippingTier[]): ShippingOption {
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);

  const match = sorted.find(
    (t) => itemCount >= t.min_qty && (t.max_qty === null || itemCount <= t.max_qty)
  );
  const price = match ? match.price : (sorted[sorted.length - 1]?.price ?? 0);

  return {
    code: FLAT_SHIPPING_CODE,
    name: "Frete",
    carrier: "",
    price,
    delivery_days: 7,
  };
}
