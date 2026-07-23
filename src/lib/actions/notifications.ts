"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { routes } from "@/lib/routes";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const service = createServiceClient();
  const { data: profile } = await service
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Não autorizado");

  return service;
}

export type AdminNotificationType = "order" | "stock" | "coupon";

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  severity: "danger" | "warning";
  title: string;
  subtitle: string;
  href: string;
  date: string; // só pra ordenar — não exibido
}

const PENDING_ORDER_STATUSES = ["pending_payment", "awaiting_validation"] as const;
const STOCK_CRITICAL_THRESHOLD = 3;
const COUPON_EXPIRING_WINDOW_DAYS = 7;
const MAX_PER_TYPE = 8;
const MAX_TOTAL = 20;

// ---------------------------------------------------------------------------
// DADOS DE TESTE — 5 notificações fake pra validar o sino (badge verde, som
// ao chegar, marcar como lida) sem precisar de pedidos/estoque/cupons reais.
// Troque para `false` (ou apague o bloco) quando terminar de testar.
// ---------------------------------------------------------------------------
const INCLUDE_TEST_NOTIFICATIONS = true;

function buildTestNotifications(): AdminNotification[] {
  const now = new Date().toISOString();
  return [
    { id: "test-order-1", type: "order", severity: "danger", title: "Pedido #1042", subtitle: "Aguardando validação · Maria Silva", href: routes.admin.pedidos, date: now },
    { id: "test-order-2", type: "order", severity: "warning", title: "Pedido #1041", subtitle: "Pagamento pendente · João Pereira", href: routes.admin.pedidos, date: now },
    { id: "test-stock-1", type: "stock", severity: "danger", title: "Camisa Polo Branca", subtitle: "Sem estoque", href: routes.admin.produtos, date: now },
    { id: "test-stock-2", type: "stock", severity: "warning", title: "Calça Jeans Slim", subtitle: "Estoque crítico · 2 un.", href: routes.admin.produtos, date: now },
    { id: "test-coupon-1", type: "coupon", severity: "warning", title: "Cupom BLACKFRIDAY10", subtitle: "Expira em até 7 dias", href: routes.admin.cupons, date: now },
  ];
}

// ---------------------------------------------------------------------------
// Notificações do sino do Admin — sempre o estado ATUAL (não é uma caixa de
// entrada com "lido/não lido"): pedidos que ainda precisam de ação, peças
// com estoque crítico, cupons expirando. Some da lista quando o problema é
// resolvido (pedido confirmado, estoque reposto, cupom desativado/renovado),
// não quando o admin só abre o sino.
// ---------------------------------------------------------------------------

export async function getAdminNotifications(): Promise<AdminNotification[] | { error: string }> {
  let service: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    service = await requireAdmin();
  } catch {
    return { error: "Não autorizado" };
  }

  const notifications: AdminNotification[] = [];

  // --- Pedidos pendentes ----------------------------------------------------
  const { data: orders } = await service
    .from("orders")
    .select("id, order_number, customer_name, status, created_at")
    .in("status", PENDING_ORDER_STATUSES)
    .order("created_at", { ascending: false })
    .limit(MAX_PER_TYPE);

  for (const o of orders ?? []) {
    notifications.push({
      id: `order-${o.id}`,
      type: "order",
      severity: o.status === "awaiting_validation" ? "danger" : "warning",
      title: `Pedido #${o.order_number}`,
      subtitle:
        o.status === "awaiting_validation"
          ? `Aguardando validação · ${o.customer_name}`
          : `Pagamento pendente · ${o.customer_name}`,
      href: routes.admin.pedido(o.id),
      date: o.created_at,
    });
  }

  // --- Estoque crítico -------------------------------------------------------
  // Estoque real: soma dos tamanhos ativos das cores ativas (produto com
  // variação) ou o campo flat `stock` (produto de tamanho único).
  const { data: products } = await service
    .from("products")
    .select(`
      id, name, is_active, track_stock, stock, updated_at,
      product_variants ( is_active, product_variant_sizes ( stock, is_active ) )
    `)
    .eq("is_active", true);

  type StockProductRow = {
    id: string;
    name: string;
    track_stock: boolean;
    stock: number | null;
    updated_at: string;
    product_variants: { is_active: boolean; product_variant_sizes: { stock: number; is_active: boolean }[] }[];
  };

  const stockNotifications = ((products ?? []) as unknown as StockProductRow[])
    .map((p) => {
      const hasVariants = p.product_variants.length > 0;
      const total = hasVariants
        ? p.product_variants
            .filter((v) => v.is_active)
            .reduce((sum, v) => sum + v.product_variant_sizes.filter((sz) => sz.is_active).reduce((a, sz) => a + sz.stock, 0), 0)
        : p.track_stock
        ? p.stock ?? 0
        : null; // estoque ilimitado — nunca crítico
      return { product: p, total };
    })
    .filter((r): r is { product: StockProductRow; total: number } => r.total !== null && r.total <= STOCK_CRITICAL_THRESHOLD)
    .sort((a, b) => a.total - b.total)
    .slice(0, MAX_PER_TYPE)
    .map(({ product, total }): AdminNotification => ({
      id: `stock-${product.id}`,
      type: "stock",
      severity: total === 0 ? "danger" : "warning",
      title: product.name,
      subtitle: total === 0 ? "Sem estoque" : `Estoque crítico · ${total} un.`,
      href: routes.admin.editarProduto(product.id),
      date: product.updated_at,
    }));
  notifications.push(...stockNotifications);

  // --- Cupons expirando --------------------------------------------------
  const expiringBefore = new Date(Date.now() + COUPON_EXPIRING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: coupons } = await service
    .from("coupons")
    .select("id, code, expiration_date")
    .eq("is_active", true)
    .not("expiration_date", "is", null)
    .lte("expiration_date", expiringBefore)
    .order("expiration_date", { ascending: true })
    .limit(MAX_PER_TYPE);

  const now = Date.now();
  for (const c of coupons ?? []) {
    const expired = new Date(c.expiration_date!).getTime() < now;
    notifications.push({
      id: `coupon-${c.id}`,
      type: "coupon",
      severity: expired ? "danger" : "warning",
      title: `Cupom ${c.code}`,
      subtitle: expired ? "Expirado, ainda ativo" : "Expira em até 7 dias",
      href: routes.admin.cupons,
      date: c.expiration_date!,
    });
  }

  if (INCLUDE_TEST_NOTIFICATIONS) notifications.push(...buildTestNotifications());

  notifications.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "danger" ? -1 : 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return notifications.slice(0, MAX_TOTAL);
}
