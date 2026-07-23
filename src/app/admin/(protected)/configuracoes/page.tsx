"use client";

import React, { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Toggle } from "@/components/common/Toggle";
import { Tabs, TabContent } from "@/components/common/Tabs";

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
  const [freeShippingAbove, setFreeShippingAbove] = useState("500");
  const [maintenanceMode, setMaintenanceMode] = useState(false);

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
            <SectionCard title="Frete grátis">
              <Input label="Frete grátis acima de (R$)" type="number" value={freeShippingAbove} onChange={(e) => setFreeShippingAbove(e.target.value)} />
              <p className="text-xs text-muted">Deixe em branco para não oferecer frete grátis automático.</p>
            </SectionCard>
            <SectionCard title="Transportadoras">
              {["Correios PAC", "Correios SEDEX", "Jadlog .E", "Total Express"].map((carrier) => (
                <div key={carrier} className="flex items-center justify-between py-2 border-b border-dark-border last:border-0">
                  <span className="text-sm text-dark-text">{carrier}</span>
                  <Toggle checked size="sm" onChange={() => {}} />
                </div>
              ))}
              <p className="text-xs text-muted mt-2">Integração com API de frete real na Fase 3.</p>
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
