"use client";

import React, { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { computeFlatShipping, DEFAULT_SHIPPING_TIERS, type ShippingTier } from "@/lib/shipping";
import { formatCurrency } from "@/lib/formatters";
import { useCartStore } from "@/store/cart-store";

// Frete fixo por faixa de quantidade — nada pra calcular, nada pra escolher.
// Busca as faixas configuradas (Admin > Configurações > Frete) e aplica
// sozinho assim que o carrinho tem itens.
export const ShippingFlatInfo = () => {
  const { items, shipping_option, setShipping } = useCartStore();
  const [tiers, setTiers] = useState<ShippingTier[]>(DEFAULT_SHIPPING_TIERS);

  useEffect(() => {
    let active = true;
    createClient()
      .from("shipping_tiers")
      .select("min_qty, max_qty, price")
      .order("min_qty", { ascending: true })
      .then(({ data }) => {
        if (!active || !data || data.length === 0) return;
        setTiers(data.map((t) => ({ min_qty: t.min_qty, max_qty: t.max_qty, price: Number(t.price) })));
      });
    return () => {
      active = false;
    };
  }, []);

  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  useEffect(() => {
    if (itemCount === 0) return;
    const option = computeFlatShipping(itemCount, tiers);
    if (shipping_option?.code === option.code && shipping_option?.price === option.price) return;
    setShipping(option);
    // shipping_option/setShipping vêm do zustand — não precisam entrar nas deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount, tiers]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-dark-text">
        <Truck size={16} className="text-accent" />
        Frete
      </div>
      {shipping_option ? (
        <p className="text-sm text-dark-text">
          <span className="font-semibold text-accent">{formatCurrency(shipping_option.price)}</span>
          {" "}— entrega para todo o Brasil
        </p>
      ) : (
        <p className="text-sm text-muted">Calculando frete...</p>
      )}
    </div>
  );
};
