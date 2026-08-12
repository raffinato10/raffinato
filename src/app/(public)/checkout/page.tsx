"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { CheckoutSteps } from "@/components/public/CheckoutSteps";
import { Container } from "@/components/common/SectionHeader";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { formatCurrency } from "@/lib/formatters";
import { maskCep, maskPhone, maskCpf, maskCardNumber, maskCardExpiry } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import { routes } from "@/lib/routes";
import { createOrder, type CheckoutFormData } from "@/lib/actions/checkout";

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

// --- Integração 3DS (SDK Zendry, usado pela PYX Gate) -----------------------
// O SDK roda o desafio 3DS inteiro no browser e não tokeniza o cartão — os
// dados brutos (pan/validade/cvv) só vão pro backend depois, no createOrder.
// Ver aviso de escopo PCI-DSS em src/lib/payments/pyxgate-provider.ts.

interface ZendryThreeDsResult {
  operation_session_id: string;
  xid: string;
  eci: string;
  cavv: string;
  secure_version: string;
  directory_server_transaction_id: string;
  three_ds_server_transaction_id: string;
}

interface ZendrySDKThreeds {
  init_threeds: (params: {
    token: string;
    amount: number;
    payment_form: {
      pan: string;
      expiry_month: string;
      expiry_year: string;
      card_holder_name: string;
      account_type: string;
      network_preference: string;
    };
    onSuccess: (result: { three_ds_data: ZendryThreeDsResult }) => void;
    onFailure: (result?: unknown) => void;
    onError: (err?: unknown) => void;
  }) => void;
}

declare global {
  interface Window {
    ZendrySDKThreeds?: ZendrySDKThreeds;
  }
}

const ZENDRY_SDK_URL = "https://cdn.zendry.com/v1/zendry-sdk-threeds.min.js";
const ZENDRY_SDK_SCRIPT_ID = "zendry-sdk-threeds";

function loadZendrySdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.ZendrySDKThreeds) { resolve(); return; }
    const existing = document.getElementById(ZENDRY_SDK_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Não foi possível carregar o autenticador do cartão.")));
      return;
    }
    const script = document.createElement("script");
    script.id = ZENDRY_SDK_SCRIPT_ID;
    script.src = ZENDRY_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Não foi possível carregar o autenticador do cartão."));
    document.body.appendChild(script);
  });
}

function runZendry3ds(params: {
  token: string;
  amountCents: number;
  pan: string;
  expiryMonth: string;
  expiryYear: string;
  cardHolderName: string;
}): Promise<ZendryThreeDsResult> {
  return new Promise((resolve, reject) => {
    const sdk = window.ZendrySDKThreeds;
    if (!sdk) { reject(new Error("Autenticador do cartão indisponível.")); return; }
    sdk.init_threeds({
      token: params.token,
      amount: params.amountCents,
      payment_form: {
        pan: params.pan,
        expiry_month: params.expiryMonth,
        expiry_year: params.expiryYear,
        card_holder_name: params.cardHolderName,
        account_type: "credit",
        network_preference: "",
      },
      onSuccess: (result) => resolve(result.three_ds_data),
      onFailure: () => reject(new Error("Autenticação do cartão (3DS) não foi aprovada.")),
      onError: () => reject(new Error("Erro ao autenticar o cartão. Tente novamente.")),
    });
  });
}

export default function CheckoutPage() {
  const router = useRouter();

  const {
    items,
    getSubtotal,
    getShippingValue,
    getCouponDiscount,
    getTotalPix,
    getTotalCard,
    shipping_option,
    coupon_code,
  } = useCartStore();

  const [name,         setName]         = useState("");
  const [email,        setEmail]        = useState("");
  const [phone,        setPhone]        = useState("");
  const [cpf,          setCpf]          = useState("");
  const [cep,          setCep]          = useState("");
  const [street,       setStreet]       = useState("");
  const [number,       setNumber]       = useState("");
  const [complement,   setComplement]   = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city,         setCity]         = useState("");
  const [state,        setState]        = useState("");

  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card">("pix");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName,   setCardName]   = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv,    setCardCvv]    = useState("");

  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState("");

  const subtotal = getSubtotal();
  const shipping = getShippingValue();
  const discount = getCouponDiscount();
  const total    = paymentMethod === "card" ? getTotalCard() : getTotalPix();

  const handleSubmit = async () => {
    setSubmitError("");

    // Validação client-side rápida
    if (!name.trim())         { setSubmitError("Nome é obrigatório.");        return; }
    if (!email.trim())        { setSubmitError("E-mail é obrigatório.");      return; }
    if (!phone.trim())        { setSubmitError("Telefone é obrigatório.");    return; }
    if (!cep.trim())          { setSubmitError("CEP é obrigatório.");         return; }
    if (!street.trim())       { setSubmitError("Logradouro é obrigatório."); return; }
    if (!number.trim())       { setSubmitError("Número é obrigatório.");      return; }
    if (!neighborhood.trim()) { setSubmitError("Bairro é obrigatório.");      return; }
    if (!city.trim())         { setSubmitError("Cidade é obrigatória.");      return; }
    if (!state)               { setSubmitError("Estado é obrigatório.");      return; }
    if (items.length === 0)   { setSubmitError("Seu carrinho está vazio.");   return; }

    const cardDigits = cardNumber.replace(/\D/g, "");
    const [expMonth, expYearShort] = cardExpiry.split("/");
    const cvvDigits = cardCvv.replace(/\D/g, "");

    if (paymentMethod === "card") {
      if (cardDigits.length < 13)      { setSubmitError("Número do cartão inválido.");  return; }
      if (!cardName.trim())            { setSubmitError("Nome impresso no cartão é obrigatório."); return; }
      if (!expMonth || expMonth.length !== 2 || !expYearShort || expYearShort.length !== 2) {
        setSubmitError("Validade do cartão inválida.");
        return;
      }
      if (cvvDigits.length < 3)        { setSubmitError("CVV inválido.");               return; }
    }

    setSubmitting(true);

    try {
      let orderPayload: CheckoutFormData = {
        name,
        email,
        phone,
        cpf,
        cep,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        items: items.map((i) => ({
          product_id: i.product_id,
          variant_size_id: i.variant_size_id,
          quantity: i.quantity,
        })),
        coupon_code:   coupon_code ?? undefined,
        shipping_code: shipping_option?.code ?? "",
        payment_method: paymentMethod,
      };

      if (paymentMethod === "card") {
        const expYear = `20${expYearShort}`;

        const tokenRes = await fetch("/api/payments/card/3ds-token");
        const tokenJson = await tokenRes.json();
        if (!tokenRes.ok || !tokenJson.token) {
          setSubmitError(tokenJson.error ?? "Não foi possível iniciar o pagamento com cartão.");
          setSubmitting(false);
          return;
        }

        await loadZendrySdk();

        const threeDs = await runZendry3ds({
          token: tokenJson.token,
          amountCents: Math.round(total * 100),
          pan: cardDigits,
          expiryMonth: expMonth,
          expiryYear: expYear,
          cardHolderName: cardName.trim(),
        });

        orderPayload = {
          ...orderPayload,
          card: {
            pan: cardDigits,
            expiryMonth: expMonth,
            expiryYear: expYear,
            cardHolderName: cardName.trim(),
            cvv: cvvDigits,
          },
          threeDsData: {
            operationSessionId: threeDs.operation_session_id,
            xid: threeDs.xid,
            eci: threeDs.eci,
            cavv: threeDs.cavv,
            secureVersion: threeDs.secure_version,
            directoryServerTransactionId: threeDs.directory_server_transaction_id,
            threeDsServerTransactionId: threeDs.three_ds_server_transaction_id,
          },
        };
      }

      const result = await createOrder(orderPayload);

      if ("error" in result) {
        setSubmitError(result.error);
        setSubmitting(false);
        return;
      }

      if (result.paymentStatus === "approved") {
        router.push(routes.pedidoConfirmado(result.orderId));
        return;
      }

      router.push(`/pagamento/${result.orderId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao processar pagamento.");
      setSubmitting(false);
    }
  };

  return (
    <div className="py-12">
      <Container>
        <div className="mb-8">
          <CheckoutSteps currentStep={2} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">

            {/* Personal data */}
            <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 space-y-4">
              <h2 className="text-base font-bold text-dark-text">Dados pessoais</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Nome completo" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" />
                <Input label="CPF" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
                <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
                <Input label="Telefone / WhatsApp" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
              </div>
            </div>

            {/* Address */}
            <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 space-y-4">
              <h2 className="text-base font-bold text-dark-text">Endereço de entrega</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="CEP" value={cep} onChange={(e) => setCep(maskCep(e.target.value))} placeholder="00000-000" maxLength={9} />
                <div className="md:col-span-2">
                  <Input label="Logradouro" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua, Avenida, etc." />
                </div>
                <Input label="Número" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Nº" />
                <Input label="Complemento" value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto, bloco..." />
                <Input label="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Seu bairro" />
                <div className="md:col-span-2">
                  <Input label="Cidade" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sua cidade" />
                </div>
                <Select
                  label="Estado"
                  value={state}
                  onChange={(v) => setState(v)}
                  options={ESTADOS.map((uf) => ({ value: uf, label: uf }))}
                  placeholder="UF"
                />
              </div>
            </div>

            {/* Payment method */}
            <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 space-y-4">
              <h2 className="text-base font-bold text-dark-text">Forma de pagamento</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pix")}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-colors ${
                    paymentMethod === "pix" ? "border-accent bg-accent/5" : "border-dark-border hover:border-accent/40"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    paymentMethod === "pix" ? "border-accent" : "border-dark-border-light"
                  }`}>
                    {paymentMethod === "pix" && <div className="w-2 h-2 rounded-full bg-accent" />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-dark-text">Pix</div>
                    <div className="text-xs text-success">Aprovação imediata · Melhor preço</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-colors ${
                    paymentMethod === "card" ? "border-accent bg-accent/5" : "border-dark-border hover:border-accent/40"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    paymentMethod === "card" ? "border-accent" : "border-dark-border-light"
                  }`}>
                    {paymentMethod === "card" && <div className="w-2 h-2 rounded-full bg-accent" />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-dark-text">Cartão de crédito</div>
                    <div className="text-xs text-muted">Aprovação na hora</div>
                  </div>
                </button>
              </div>

              {paymentMethod === "card" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="md:col-span-2">
                    <Input
                      label="Número do cartão"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
                      placeholder="0000 0000 0000 0000"
                      maxLength={23}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      label="Nome impresso no cartão"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value.toUpperCase())}
                      placeholder="Como está no cartão"
                    />
                  </div>
                  <Input
                    label="Validade"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(maskCardExpiry(e.target.value))}
                    placeholder="MM/AA"
                    maxLength={5}
                  />
                  <Input
                    label="CVV"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="000"
                    maxLength={4}
                  />
                </div>
              )}
            </div>

          </div>

          {/* Summary */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-dark-text">Resumo do pedido</h2>
            <div className="bg-dark-surface rounded-2xl border border-dark-border p-5 space-y-3 sticky top-24">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="text-dark-text">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Cupom {coupon_code && `(${coupon_code})`}</span>
                  <span className="text-success">-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted">Frete</span>
                <span className="text-dark-text">
                  {shipping === 0 && shipping_option ? "Grátis" : shipping ? formatCurrency(shipping) : "—"}
                </span>
              </div>
              <div className="border-t border-dark-border pt-3">
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-dark-text">
                    Total {paymentMethod === "card" ? "no cartão" : "no Pix"}
                  </span>
                  <span className="text-lg font-bold text-accent">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Erro de submit */}
              {submitError && (
                <div className="flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-xl">
                  <AlertCircle size={15} className="text-danger flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-danger">{submitError}</p>
                </div>
              )}

              <Button
                variant="accent"
                fullWidth
                size="lg"
                isLoading={submitting}
                onClick={handleSubmit}
              >
                Finalizar pedido
              </Button>
              <p className="text-xs text-center text-muted">
                {paymentMethod === "card"
                  ? "Você será redirecionado assim que o pagamento for autorizado"
                  : "Você receberá as instruções de pagamento após confirmar"}
              </p>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
