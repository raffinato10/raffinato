"use client";

import React, { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { computeFlatShipping, DEFAULT_FLAT_SHIPPING_SETTINGS, type FlatShippingSettings } from "@/lib/shipping";
import { formatCurrency } from "@/lib/formatters";
import { useCartStore } from "@/store/cart-store";

// Frete fixo por quantidade — nada pra calcular, nada pra escolher. Só busca
// os valores configurados (Admin > Configurações > Frete) e aplica sozinho
// assim que o carrinho tem itens.
export const ShippingFlatInfo = () => {
  const { items, shipping_option, setShipping } = useCartStore();
  const [settings, setSettings] = useState<FlatShippingSettings>(DEFAULT_FLAT_SHIPPING_SETTINGS);

  useEffect(() => {
    let active = true;
    createClient()
      .from("store_settings_public")
      .select("shipping_flat_threshold_qty, shipping_flat_price_standard, shipping_flat_price_above")
      .single()
      .then(({ data }) => {
        if (!active || !data) return;
        setSettings({
          threshold_qty: data.shipping_flat_threshold_qty,
          price_standard: Number(data.shipping_flat_price_standard),
          price_above: Number(data.shipping_flat_price_above),
        });
      });
    return () => {
      active = false;
    };
  }, []);

  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  useEffect(() => {
    if (itemCount === 0) return;
    const option = computeFlatShipping(itemCount, settings);
    if (shipping_option?.code === option.code && shipping_option?.price === option.price) return;
    setShipping(option);
    // shipping_option/setShipping vêm do zustand — não precisam entrar nas deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount, settings]);

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
