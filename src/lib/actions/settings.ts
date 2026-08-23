"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

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

export interface ShippingSettings {
  threshold_qty: number;
  price_standard: number;
  price_above: number;
}

export async function getShippingSettings(): Promise<ShippingSettings | { error: string }> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("store_settings_public")
    .select("shipping_flat_threshold_qty, shipping_flat_price_standard, shipping_flat_price_above")
    .single();

  if (error || !data) return { error: "Erro ao carregar configuração de frete." };

  return {
    threshold_qty: data.shipping_flat_threshold_qty,
    price_standard: Number(data.shipping_flat_price_standard),
    price_above: Number(data.shipping_flat_price_above),
  };
}

export async function updateShippingSettings(
  settings: ShippingSettings
): Promise<{ error?: string }> {
  try {
    await assertAdmin();
  } catch {
    return { error: "Não autorizado." };
  }

  if (!Number.isInteger(settings.threshold_qty) || settings.threshold_qty < 1) {
    return { error: "Quantidade limite precisa ser um número inteiro maior que zero." };
  }
  if (settings.price_standard < 0 || settings.price_above < 0) {
    return { error: "Os valores de frete não podem ser negativos." };
  }

  const service = createServiceClient();
  const { error } = await service
    .from("store_settings_public")
    .update({
      shipping_flat_threshold_qty: settings.threshold_qty,
      shipping_flat_price_standard: settings.price_standard,
      shipping_flat_price_above: settings.price_above,
      updated_at: new Date().toISOString(),
    })
    .eq("lock", true);

  if (error) return { error: error.message };

  return {};
}
