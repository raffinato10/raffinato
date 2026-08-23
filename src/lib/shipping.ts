import type { ShippingOption } from "@/types";

// Frete fixo por quantidade de itens — mesmo valor para todo o Brasil, sem
// nome de transportadora (o lojista escolhe qual usar só na hora do envio).
// Fonte de verdade: store_settings_public (editável em Admin > Configurações
// > Frete). Esses valores são só o fallback caso a leitura da config falhe.

export interface FlatShippingSettings {
  threshold_qty: number;
  price_standard: number;
  price_above: number;
}

export const DEFAULT_FLAT_SHIPPING_SETTINGS: FlatShippingSettings = {
  threshold_qty: 5,
  price_standard: 35,
  price_above: 40,
};

export const FLAT_SHIPPING_CODE = "FLAT";

export function computeFlatShipping(
  itemCount: number,
  settings: FlatShippingSettings
): ShippingOption {
  const price = itemCount > settings.threshold_qty ? settings.price_above : settings.price_standard;
  return {
    code: FLAT_SHIPPING_CODE,
    name: "Frete",
    carrier: "",
    price,
    delivery_days: 7,
  };
}
