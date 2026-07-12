"use client";

import React, { useState } from "react";
import { Truck, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { formatCurrency } from "@/lib/formatters";
import { maskCep } from "@/lib/utils";
import { getShippingForCep } from "@/data/mock-shipping";
import { useCartStore } from "@/store/cart-store";
import type { ShippingOption } from "@/types";

export const ShippingCalculatorMock = () => {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [error, setError] = useState("");
  const { shipping_option, setShipping } = useCartStore();

  const handleCalculate = async () => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length < 8) {
      setError("CEP inválido. Digite os 8 dígitos.");
      return;
    }
    setError("");
    setLoading(true);
    // Simula delay de API
    await new Promise((r) => setTimeout(r, 1200));
    const results = getShippingForCep(clean);
    setOptions(results);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-dark-text">
        <Truck size={16} className="text-accent" />
        Calcular frete
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="00000-000"
          value={cep}
          onChange={(e) => {
            setCep(maskCep(e.target.value));
            setOptions([]);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleCalculate()}
          maxLength={9}
          error={error}
          className="flex-1"
        />
        <Button
          variant="outline"
          onClick={handleCalculate}
          isLoading={loading}
          disabled={cep.replace(/\D/g, "").length < 8}
          className="flex-shrink-0"
        >
          {loading ? "" : "Calcular"}
        </Button>
      </div>

      {/* Options */}
      {options.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          {options.map((opt) => (
            <label
              key={opt.code}
              className={[
                "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-150",
                shipping_option?.code === opt.code
                  ? "border-accent bg-accent-dim"
                  : "border-dark-border-light hover:border-accent/40 bg-dark-surface",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                    shipping_option?.code === opt.code
                      ? "border-accent"
                      : "border-dark-border-light",
                  ].join(" ")}
                >
                  {shipping_option?.code === opt.code && (
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  )}
                </div>
                <input
                  type="radio"
                  name="shipping"
                  value={opt.code}
                  checked={shipping_option?.code === opt.code}
                  onChange={() => setShipping(opt)}
                  className="sr-only"
                />
                <div>
                  <div className="text-sm font-medium text-dark-text">
                    {opt.carrier} — {opt.name}
                  </div>
                  <div className="text-xs text-muted">
                    Entrega em até {opt.delivery_days} dias úteis
                  </div>
                </div>
              </div>
              <span className="text-sm font-semibold text-dark-text">
                {opt.price === 0 ? (
                  <span className="text-success">Grátis</span>
                ) : (
                  formatCurrency(opt.price)
                )}
              </span>
            </label>
          ))}

          {shipping_option && (
            <p className="text-xs text-success flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              Frete selecionado: {shipping_option.name} — {formatCurrency(shipping_option.price)}
            </p>
          )}

          <p className="text-xs text-muted">
            * Valores e prazos calculados com base no CEP informado. Os valores reais são confirmados no checkout.
          </p>
        </div>
      )}
    </div>
  );
};
