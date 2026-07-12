"use client";

import React, { useState } from "react";
import { Search, Package, ArrowLeft } from "lucide-react";
import { Container } from "@/components/common/SectionHeader";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Tabs } from "@/components/common/Tabs";
import { EmptyState } from "@/components/common/EmptyState";
import { OrderDetailView } from "@/components/public/OrderDetailView";
import { OrderSummaryCard } from "@/components/public/OrderSummaryCard";
import { maskPhone, maskCpf } from "@/lib/utils";
import { generateStoreWhatsAppLink } from "@/lib/whatsapp";
import {
  lookupOrderByNumber,
  lookupOrdersByCpf,
  lookupOrdersByEmail,
  type PublicOrderDetail,
  type OrderConfirmType,
  type EmailConfirmType,
} from "@/lib/actions/order-lookup";

type Method = "number" | "cpf" | "email";
type ConfirmKind = "phone" | "email" | "cpf";

type SearchResult =
  | { kind: "single"; order: PublicOrderDetail }
  | { kind: "list"; orders: PublicOrderDetail[] };

// ---------------------------------------------------------------------------
// Toggle + campo de confirmação reutilizável — o cliente escolhe
// explicitamente com qual dado (telefone/e-mail/CPF) ele vai confirmar,
// em vez do sistema adivinhar pelo formato digitado. Cada aba usa o
// subconjunto de opções que faz sentido (nunca repete o campo principal
// daquela aba como opção de confirmação).
// ---------------------------------------------------------------------------

const CONFIRM_FIELD_CONFIG: Record<ConfirmKind, { label: string; placeholder: string; type?: string; maxLength?: number; mask?: (v: string) => string }> = {
  phone: { label: "Telefone", placeholder: "(00) 00000-0000", maxLength: 15, mask: maskPhone },
  email: { label: "E-mail", placeholder: "seu@email.com", type: "email" },
  cpf: { label: "CPF", placeholder: "000.000.000-00", maxLength: 14, mask: maskCpf },
};

function ConfirmField<T extends ConfirmKind>({
  options,
  type,
  onTypeChange,
  value,
  onValueChange,
  onEnter,
}: {
  options: T[];
  type: T;
  onTypeChange: (t: T) => void;
  value: string;
  onValueChange: (v: string) => void;
  onEnter: () => void;
}) {
  const config = CONFIRM_FIELD_CONFIG[type];
  return (
    <div>
      <p className="text-sm font-medium text-dark-text mb-1.5">Confirmar com</p>
      <div className="flex gap-2 mb-3">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => { onTypeChange(opt); onValueChange(""); }}
            className={[
              "flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-all",
              type === opt
                ? "bg-accent/10 border-accent text-accent"
                : "bg-dark-alt border-dark-border-light text-muted hover:text-dark-text",
            ].join(" ")}
          >
            {CONFIRM_FIELD_CONFIG[opt].label}
          </button>
        ))}
      </div>
      <Input
        label={`${config.label} de confirmação`}
        type={config.type ?? "text"}
        placeholder={config.placeholder}
        value={value}
        onChange={(e) => onValueChange(config.mask ? config.mask(e.target.value) : e.target.value)}
        maxLength={config.maxLength}
        onKeyDown={(e) => e.key === "Enter" && onEnter()}
      />
    </div>
  );
}

export default function AcompanharPedidoClient() {
  const [method, setMethod] = useState<Method>("number");

  const [orderNumber, setOrderNumber] = useState("");
  const [numberConfirmType, setNumberConfirmType] = useState<OrderConfirmType>("phone");
  const [numberConfirmValue, setNumberConfirmValue] = useState("");

  const [cpf, setCpf] = useState("");
  const [cpfConfirmType, setCpfConfirmType] = useState<OrderConfirmType>("phone");
  const [cpfConfirmValue, setCpfConfirmValue] = useState("");

  const [email, setEmail] = useState("");
  const [emailConfirmType, setEmailConfirmType] = useState<EmailConfirmType>("phone");
  const [emailConfirmValue, setEmailConfirmValue] = useState("");

  const [loading, setLoading] = useState(false);
  // Validação client-side (campo vazio) — some sozinha, sem WhatsApp, some ao
  // corrigir o campo. Diferente de lookupError: erro real de busca (não
  // encontrado, rate limit, formato inválido), mostrado como resultado
  // "elegante" com botão de WhatsApp, conforme pedido.
  const [formError, setFormError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [viewingOrder, setViewingOrder] = useState<PublicOrderDetail | null>(null);

  const resetSearchState = () => {
    setFormError("");
    setLookupError("");
    setResult(null);
    setViewingOrder(null);
  };

  const handleMethodChange = (value: string) => {
    setMethod(value as Method);
    resetSearchState();
  };

  const handleSearch = async () => {
    resetSearchState();
    setLoading(true);

    try {
      if (method === "number") {
        if (!orderNumber.trim() || !numberConfirmValue.trim()) {
          setFormError(`Preencha o número do pedido e o ${numberConfirmType === "phone" ? "telefone" : "e-mail"} de confirmação.`);
          return;
        }
        const res = await lookupOrderByNumber(orderNumber, numberConfirmValue, numberConfirmType);
        if ("error" in res) { setLookupError(res.error); return; }
        setResult({ kind: "single", order: res.order });
      } else if (method === "cpf") {
        if (!cpf.trim() || !cpfConfirmValue.trim()) {
          setFormError(`Preencha o CPF e o ${cpfConfirmType === "phone" ? "telefone" : "e-mail"} de confirmação.`);
          return;
        }
        const res = await lookupOrdersByCpf(cpf, cpfConfirmValue, cpfConfirmType);
        if ("error" in res) { setLookupError(res.error); return; }
        setResult(res.orders.length === 1 ? { kind: "single", order: res.orders[0] } : { kind: "list", orders: res.orders });
      } else {
        if (!email.trim() || !emailConfirmValue.trim()) {
          setFormError(`Preencha o e-mail e o ${emailConfirmType === "phone" ? "telefone" : "CPF"} de confirmação.`);
          return;
        }
        const res = await lookupOrdersByEmail(email, emailConfirmValue, emailConfirmType);
        if ("error" in res) { setLookupError(res.error); return; }
        setResult(res.orders.length === 1 ? { kind: "single", order: res.orders[0] } : { kind: "list", orders: res.orders });
      }
    } finally {
      setLoading(false);
    }
  };

  const showingDetail = result?.kind === "single" ? result.order : viewingOrder;

  return (
    <div className="py-12">
      <Container size="sm">
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-dark-text mb-2">Acompanhar pedido</h1>
          <p className="text-muted">Escolha uma forma de localizar sua compra.</p>
        </div>

        {/* Esconde a busca quando já está vendo o detalhe de um pedido vindo de uma lista */}
        {!showingDetail && (
          <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 space-y-5 mb-8">
            <Tabs
              variant="pills"
              value={method}
              onChange={handleMethodChange}
              tabs={[
                { value: "number", label: "Número do pedido" },
                { value: "cpf", label: "CPF" },
                { value: "email", label: "E-mail" },
              ]}
            />

            <div className="space-y-4">
              {method === "number" && (
                <>
                  <Input
                    label="Número do pedido"
                    placeholder="Ex: ORD-20241201-0001"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <ConfirmField
                    options={["phone", "email"] as const}
                    type={numberConfirmType}
                    onTypeChange={setNumberConfirmType}
                    value={numberConfirmValue}
                    onValueChange={setNumberConfirmValue}
                    onEnter={handleSearch}
                  />
                </>
              )}

              {method === "cpf" && (
                <>
                  <Input
                    label="CPF"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(maskCpf(e.target.value))}
                    maxLength={14}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <ConfirmField
                    options={["phone", "email"] as const}
                    type={cpfConfirmType}
                    onTypeChange={setCpfConfirmType}
                    value={cpfConfirmValue}
                    onValueChange={setCpfConfirmValue}
                    onEnter={handleSearch}
                  />
                </>
              )}

              {method === "email" && (
                <>
                  <Input
                    label="E-mail"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <ConfirmField
                    options={["phone", "cpf"] as const}
                    type={emailConfirmType}
                    onTypeChange={setEmailConfirmType}
                    value={emailConfirmValue}
                    onValueChange={setEmailConfirmValue}
                    onEnter={handleSearch}
                  />
                </>
              )}

              {formError && (
                <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{formError}</p>
              )}

              <Button variant="accent" fullWidth onClick={handleSearch} isLoading={loading} leftIcon={<Search size={16} />}>
                Buscar pedido
              </Button>
            </div>
          </div>
        )}

        {/* Resultado: detalhe direto (1 pedido) */}
        {showingDetail && (
          <div className="space-y-4">
            {result?.kind === "list" && (
              <button
                onClick={() => setViewingOrder(null)}
                className="flex items-center gap-1.5 text-sm text-muted hover:text-accent transition-colors"
              >
                <ArrowLeft size={14} />
                Voltar para meus pedidos
              </button>
            )}
            <OrderDetailView order={showingDetail} />
          </div>
        )}

        {/* Resultado: lista "Meus pedidos" */}
        {result?.kind === "list" && !viewingOrder && (
          <div className="space-y-3 animate-fade-in">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Meus pedidos ({result.orders.length})
            </h2>
            {result.orders.map((order) => (
              <OrderSummaryCard key={order.order_number} order={order} onSelect={() => setViewingOrder(order)} />
            ))}
          </div>
        )}

        {/* Sem resultado: mensagem elegante + WhatsApp, conforme pedido */}
        {lookupError && (
          <EmptyState
            title={lookupError}
            action={{
              label: "Falar no WhatsApp",
              onClick: () => window.open(generateStoreWhatsAppLink(), "_blank"),
              variant: "accent",
            }}
          />
        )}
      </Container>
    </div>
  );
}
