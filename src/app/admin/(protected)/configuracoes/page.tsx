"use client";

import React, { useEffect, useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Toggle } from "@/components/common/Toggle";
import { Tabs, TabContent } from "@/components/common/Tabs";
import { getShippingTiers, updateShippingTiers } from "@/lib/actions/settings";
import type { ShippingTier } from "@/lib/shipping";

interface TierRow {
  key: string;
  min_qty: string;
  max_qty: string; // "" = sem limite superior
  price: string;
}

let tierKeySeq = 0;
const newTierKey = () => `tier-${++tierKeySeq}`;

const tierToRow = (t: ShippingTier): TierRow => ({
  key: newTierKey(),
  min_qty: String(t.min_qty),
  max_qty: t.max_qty === null ? "" : String(t.max_qty),
  price: String(t.price),
});

const TABS = [
  { value: "loja", label: "Loja" },
  { value: "pagamentos", label: "Pagamentos" },
  { value: "frete", label: "Frete" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "usuarios", label: "Usuários" },
  { value: "aparencia", label: "Aparência" },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 space-y-4">
      <h2 className="text-sm font-bold text-dark-text">{title}</h2>
      {children}
    </div>
  );
}

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState("loja");
  const [storeName, setStoreName] = useState("Raffinato");
  const [storeEmail, setStoreEmail] = useState("contato@premiumstore.com.br");
  const [whatsapp, setWhatsapp] = useState("5511999999999");
  const [pixKey, setPixKey] = useState("contato@premiumstore.com.br");
  const [pixEnabled, setPixEnabled] = useState(true);
  const [cardEnabled, setCardEnabled] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Frete fixo por faixa de quantidade — único bloco desta tela que já
  // persiste de verdade (shipping_tiers), o resto das abas ainda é mock.
  const [tierRows, setTierRows] = useState<TierRow[]>([]);
  const [shippingLoading, setShippingLoading] = useState(true);
  const [shippingSaving, setShippingSaving] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [shippingSaved, setShippingSaved] = useState(false);

  useEffect(() => {
    getShippingTiers().then((result) => {
      if ("error" in result) {
        setShippingError(result.error);
      } else {
        setTierRows(result.length > 0 ? result.map(tierToRow) : [tierToRow({ min_qty: 1, max_qty: null, price: 0 })]);
      }
      setShippingLoading(false);
    });
  }, []);

  const addTierRow = () => {
    const last = tierRows[tierRows.length - 1];
    const nextMin = last?.max_qty ? Number(last.max_qty) + 1 : last ? Number(last.min_qty) + 1 : 1;
    setTierRows([...tierRows, { key: newTierKey(), min_qty: String(nextMin), max_qty: "", price: "" }]);
  };

  const removeTierRow = (key: string) => {
    setTierRows(tierRows.filter((r) => r.key !== key));
  };

  const updateTierRow = (key: string, field: "min_qty" | "max_qty" | "price", value: string) => {
    setTierRows(tierRows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const handleSaveShipping = async () => {
    setShippingError("");
    setShippingSaved(false);

    const tiers: ShippingTier[] = [];
    for (const row of tierRows) {
      const min_qty = parseInt(row.min_qty, 10);
      const price = parseFloat(row.price);
      if (!Number.isInteger(min_qty) || Number.isNaN(price)) {
        setShippingError("Preencha \"de\" e o valor de frete em todas as faixas.");
        return;
      }
      const max_qty = row.max_qty.trim() === "" ? null : parseInt(row.max_qty, 10);
      tiers.push({ min_qty, max_qty, price });
    }

    setShippingSaving(true);
    const result = await updateShippingTiers(tiers);
    setShippingSaving(false);

    if (result.error) {
      setShippingError(result.error);
      return;
    }
    setShippingSaved(true);
    setTimeout(() => setShippingSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Configurações</h1>
          <p className="text-sm text-muted mt-1">Gerencie as configurações da loja</p>
        </div>
        <Button variant="accent" leftIcon={<Save size={16} />}>Salvar alterações</Button>
      </div>

      <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab}>
        <TabContent value="loja" active={activeTab}>
          <div className="space-y-4 mt-6">
            <SectionCard title="Informações da loja">
              <Input label="Nome da loja" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
              <Input label="E-mail de contato" type="email" value={storeEmail} onChange={(e) => setStoreEmail(e.target.value)} />
              <Input label="CNPJ / CPF" placeholder="00.000.000/0001-00" />
            </SectionCard>
            <SectionCard title="Modo de manutenção">
              <div className="flex items-center gap-4">
                <Toggle checked={maintenanceMode} onChange={setMaintenanceMode} />
                <div>
                  <p className="text-sm text-dark-text">Loja em manutenção</p>
                  <p className="text-xs text-muted">Clientes verão uma página de manutenção</p>
                </div>
              </div>
            </SectionCard>
          </div>
        </TabContent>

        <TabContent value="pagamentos" active={activeTab}>
          <div className="space-y-4 mt-6">
            <SectionCard title="Pix">
              <div className="flex items-center gap-4 mb-4">
                <Toggle checked={pixEnabled} onChange={setPixEnabled} />
                <span className="text-sm text-dark-text">Habilitar Pix</span>
              </div>
              <Input label="Chave Pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, CNPJ, e-mail ou telefone" />
              <Input label="Nome do beneficiário" defaultValue="Raffinato" />
            </SectionCard>
            <SectionCard title="Cartão de crédito">
              <div className="flex items-center gap-4 mb-4">
                <Toggle checked={cardEnabled} onChange={setCardEnabled} />
                <div>
                  <p className="text-sm text-dark-text">Habilitar cartão de crédito</p>
                  <p className="text-xs text-muted">Requer integração com Mercado Pago (Fase 2)</p>
                </div>
              </div>
              {cardEnabled && (
                <div className="p-3 bg-warning/5 border border-warning/20 rounded-xl text-xs text-warning">
                  Integração com Mercado Pago será configurada na Fase 2.
                </div>
              )}
            </SectionCard>
          </div>
        </TabContent>

        <TabContent value="frete" active={activeTab}>
          <div className="space-y-4 mt-6">
            <SectionCard title="Frete fixo por faixa de quantidade">
              <p className="text-xs text-muted -mt-1">
                Mesmo valor para todos os clientes, em todo o Brasil — não aparece nome de
                transportadora pro cliente, você escolhe qual usar na hora do envio. Adicione
                quantas faixas quiser; deixe "até" em branco na última pra não ter limite superior.
              </p>

              {shippingLoading ? (
                <p className="text-sm text-muted">Carregando...</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs text-muted px-1">
                      <span>De (itens)</span>
                      <span>Até (itens, opcional)</span>
                      <span>Frete (R$)</span>
                      <span />
                    </div>
                    {tierRows.map((row) => (
                      <div key={row.key} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start">
                        <Input
                          type="number"
                          min={1}
                          placeholder="De"
                          value={row.min_qty}
                          onChange={(e) => updateTierRow(row.key, "min_qty", e.target.value)}
                        />
                        <Input
                          type="number"
                          min={1}
                          placeholder="Sem limite"
                          value={row.max_qty}
                          onChange={(e) => updateTierRow(row.key, "max_qty", e.target.value)}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="Valor"
                          value={row.price}
                          onChange={(e) => updateTierRow(row.key, "price", e.target.value)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTierRow(row.key)}
                          disabled={tierRows.length === 1}
                          leftIcon={<Trash2 size={14} />}
                        />
                      </div>
                    ))}
                  </div>

                  <Button variant="secondary" size="sm" leftIcon={<Plus size={14} />} onClick={addTierRow}>
                    Adicionar faixa
                  </Button>

                  {shippingError && <p className="text-xs text-danger">{shippingError}</p>}
                  {shippingSaved && <p className="text-xs text-success">Frete atualizado com sucesso.</p>}

                  <Button variant="accent" size="sm" isLoading={shippingSaving} onClick={handleSaveShipping}>
                    Salvar frete
                  </Button>
                </>
              )}
            </SectionCard>
          </div>
        </TabContent>

        <TabContent value="whatsapp" active={activeTab}>
          <div className="mt-6">
            <SectionCard title="Número do WhatsApp">
              <Input label="Número (com DDI e DDD)" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="5511999999999" />
              <Input label="Mensagem padrão" defaultValue="Olá! Vim pela loja e tenho uma dúvida." />
              <div className="p-3 bg-dark-alt rounded-xl border border-dark-border text-xs text-muted">
                <p className="font-medium text-dark-text mb-1">Pré-visualização:</p>
                <code className="text-accent break-all">https://wa.me/{whatsapp}?text=Olá!...</code>
              </div>
            </SectionCard>
          </div>
        </TabContent>

        <TabContent value="usuarios" active={activeTab}>
          <div className="mt-6">
            <SectionCard title="Usuários administrativos">
              <div className="space-y-3">
                {[
                  { name: "Admin Principal", email: "admin@loja.com", role: "Administrador" },
                  { name: "Suporte", email: "suporte@loja.com", role: "Operador" },
                ].map((user) => (
                  <div key={user.email} className="flex items-center justify-between p-3 bg-dark-alt rounded-xl border border-dark-border">
                    <div>
                      <p className="text-sm font-medium text-dark-text">{user.name}</p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </div>
                    <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-lg border border-accent/20">{user.role}</span>
                  </div>
                ))}
              </div>
              <Button variant="secondary" size="sm">+ Convidar usuário</Button>
              <p className="text-xs text-muted">Autenticação real será implementada na Fase 2 com Supabase Auth.</p>
            </SectionCard>
          </div>
        </TabContent>

        <TabContent value="aparencia" active={activeTab}>
          <div className="space-y-4 mt-6">
            <SectionCard title="Cor de destaque">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  className="w-10 h-10 rounded-full border-2 border-white scale-110 transition-all bg-accent"
                  title="#c9a84c"
                />
              </div>
              <p className="text-xs text-muted">Cor atual: <span className="text-accent font-bold">#c9a84c (Gold premium)</span></p>
              <p className="text-xs text-muted">A identidade visual da loja é fixa na paleta oficial Raffinato (preto, dourado e off-white).</p>
            </SectionCard>
            <SectionCard title="Logo e favicon">
              <Input label="URL do logo" placeholder="https://..." />
              <Input label="URL do favicon" placeholder="https://..." />
              <p className="text-xs text-muted">Upload real disponível na Fase 2.</p>
            </SectionCard>
          </div>
        </TabContent>
      </Tabs>
    </div>
  );
}
