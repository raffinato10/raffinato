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
  lookupOrdersByCpf,
  lookupOrdersByEmail,
  lookupOrdersByPhone,
  type PublicOrderDetail,
} from "@/lib/actions/order-lookup";

type Method = "cpf" | "email" | "phone";

type SearchResult =
  | { kind: "single"; order: PublicOrderDetail }
  | { kind: "list"; orders: PublicOrderDetail[] };

export default function AcompanharPedidoClient() {
  const [method, setMethod] = useState<Method>("cpf");

  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

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
      if (method === "cpf") {
        if (!cpf.trim()) { setFormError("Preencha o CPF."); return; }
        const res = await lookupOrdersByCpf(cpf);
        if ("error" in res) { setLookupError(res.error); return; }
        setResult(res.orders.length === 1 ? { kind: "single", order: res.orders[0] } : { kind: "list", orders: res.orders });
      } else if (method === "email") {
        if (!email.trim()) { setFormError("Preencha o e-mail."); return; }
        const res = await lookupOrdersByEmail(email);
        if ("error" in res) { setLookupError(res.error); return; }
        setResult(res.orders.length === 1 ? { kind: "single", order: res.orders[0] } : { kind: "list", orders: res.orders });
      } else {
        if (!phone.trim()) { setFormError("Preencha o telefone."); return; }
        const res = await lookupOrdersByPhone(phone);
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
                { value: "cpf", label: "CPF" },
                { value: "email", label: "E-mail" },
                { value: "phone", label: "Telefone" },
              ]}
            />

            <div className="space-y-4">
              {method === "cpf" && (
                <Input
                  label="CPF"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  maxLength={14}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              )}

              {method === "email" && (
                <Input
                  label="E-mail"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              )}

              {method === "phone" && (
                <Input
                  label="Telefone"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  maxLength={15}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
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
