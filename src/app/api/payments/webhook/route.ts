import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/payments";
import { processPaymentResult } from "@/lib/payments/process";
import type { Json } from "@/types/database.types";

// Valida o header x-signature que a Mercado Pago envia em todo webhook, seguindo
// https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks#editor_5.
// Só roda quando MERCADO_PAGO_WEBHOOK_SECRET está configurado (chave secreta
// gerada no painel de webhooks da aplicação) — sem ela não dá pra validar, e o
// evento segue pro fluxo normal (que já nunca confia no payload: sempre
// reconsulta o status real via provider.verifyPayment antes de agir).
function isValidMercadoPagoSignature(request: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return true;

  const signatureHeader = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  if (!signatureHeader || !requestId) return false;

  const parts: Record<string, string> = {};
  for (const chunk of signatureHeader.split(",")) {
    const [key, value] = chunk.split("=").map((s) => s.trim());
    if (key && value) parts[key] = value;
  }
  const { ts, v1: hash } = parts;
  if (!ts || !hash) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const hashBuf = Buffer.from(hash, "hex");
  if (expectedBuf.length !== hashBuf.length) return false;
  return timingSafeEqual(expectedBuf, hashBuf);
}

// POST /api/payments/webhook — endpoint público chamado pelo gateway de
// pagamento quando o status de um pagamento muda. SEMPRE responde 200 (mesmo
// em erro) para não gerar retentativas em loop por parte do gateway — qualquer
// problema é só logado em payment_webhooks.error.
//
// Nunca confia no status que vem no payload: busca o pagamento real via
// provider.verifyPayment(externalId). Idempotente via UNIQUE(external_id,
// action) em payment_webhooks — o mesmo evento nunca é processado duas vezes.
export async function POST(request: NextRequest) {
  const service = createServiceClient();

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const externalId =
    (payload.external_id as string | undefined) ??
    (payload.data as { id?: string } | undefined)?.id ??
    (payload.referenceId as string | undefined) ?? // callback do PicPay usa esse campo
    (payload.id as string | undefined);

  const action = (payload.action as string | undefined) ?? "payment.updated";
  const type = (payload.type as string | undefined) ?? "payment";

  if (!externalId) {
    return NextResponse.json({ ok: true });
  }

  // A Mercado Pago também manda o mesmo `data.id` como query string na URL de
  // notificação — é ele (não o do corpo) que entra no manifesto assinado.
  if (
    getPaymentProvider().name === "mercadopago" &&
    !isValidMercadoPagoSignature(request, request.nextUrl.searchParams.get("data.id") ?? externalId)
  ) {
    return NextResponse.json({ ok: true });
  }

  // Registra o evento antes de processar — se já existir (mesmo external_id +
  // action), a constraint única bloqueia o insert e sabemos que é repetido.
  const { error: insertError } = await service.from("payment_webhooks").insert({
    external_id: externalId,
    type,
    action,
    raw_payload: payload as Json,
  });

  if (insertError) {
    // 23505 = unique_violation — evento já processado antes, ignora.
    return NextResponse.json({ ok: true });
  }

  try {
    const provider = getPaymentProvider();
    const verification = await provider.verifyPayment(externalId);

    const { data: payment } = await service
      .from("payments")
      .select("order_id")
      .eq("external_id", externalId)
      .single();

    if (payment) {
      const result = await processPaymentResult({
        service,
        orderId: payment.order_id,
        status: verification.status,
        paidAt: verification.paidAt,
      });

      if (result.error) {
        await service
          .from("payment_webhooks")
          .update({ error: result.error })
          .eq("external_id", externalId)
          .eq("action", action);
      }
    }

    await service
      .from("payment_webhooks")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("external_id", externalId)
      .eq("action", action);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao processar webhook.";
    await service
      .from("payment_webhooks")
      .update({ error: message })
      .eq("external_id", externalId)
      .eq("action", action);
  }

  return NextResponse.json({ ok: true });
}
