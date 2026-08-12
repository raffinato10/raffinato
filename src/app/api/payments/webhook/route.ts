import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/payments";
import { processPaymentResult } from "@/lib/payments/process";
import type { Json } from "@/types/database.types";

// Valida o header PYX-Signature que a PYX Gate envia em todo webhook
// (formato "t=<timestamp>,v1=<hmac>", HMAC-SHA256 de "{timestamp}.{raw_body}").
// Só roda quando PYXGATE_WEBHOOK_SECRET está configurado (gerado no painel de
// webhooks da PYX Gate) — sem ela não dá pra validar, e o evento segue pro
// fluxo normal (que já nunca confia no payload: sempre reconsulta o status
// real via provider.verifyPayment antes de agir).
function isValidPyxGateSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.PYXGATE_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signatureHeader) return false;

  const parts: Record<string, string> = {};
  for (const chunk of signatureHeader.split(",")) {
    const [key, value] = chunk.split("=").map((s) => s.trim());
    if (key && value) parts[key] = value;
  }
  const { t: timestamp, v1: hash } = parts;
  if (!timestamp || !hash) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const hashBuf = Buffer.from(hash, "hex");
  if (expectedBuf.length !== hashBuf.length) return false;
  return timingSafeEqual(expectedBuf, hashBuf);
}

// POST /api/payments/webhook — endpoint público chamado pela PYX Gate quando
// o status de um pagamento muda. SEMPRE responde 200 (mesmo em erro) para não
// gerar retentativas em loop por parte do gateway — qualquer problema é só
// logado em payment_webhooks.error.
//
// Nunca confia no status que vem no payload: busca o pagamento real via
// provider.verifyPayment(externalId). Idempotente via UNIQUE(external_id,
// action) em payment_webhooks — o mesmo evento nunca é processado duas vezes.
//
// Formato do payload (evento payment.paid/payment.failed/...):
// { id: "evt_...", type: "payment.paid", data: { object: { id: "pay_...", status: "paid" } } }
export async function POST(request: NextRequest) {
  const service = createServiceClient();

  // Lê como texto primeiro — a assinatura é calculada sobre o corpo bruto,
  // não sobre o JSON re-serializado.
  const rawBody = await request.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (!isValidPyxGateSignature(rawBody, request.headers.get("PYX-Signature"))) {
    return NextResponse.json({ ok: true });
  }

  const dataObject = (payload.data as { object?: { id?: string } } | undefined)?.object;
  const externalId = dataObject?.id ?? (payload.id as string | undefined);
  const eventType = (payload.type as string | undefined) ?? "payment.updated";

  if (!externalId) {
    return NextResponse.json({ ok: true });
  }

  // Registra o evento antes de processar — se já existir (mesmo external_id +
  // action), a constraint única bloqueia o insert e sabemos que é repetido.
  const { error: insertError } = await service.from("payment_webhooks").insert({
    external_id: externalId,
    type: "payment",
    action: eventType,
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
          .eq("action", eventType);
      }
    }

    await service
      .from("payment_webhooks")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("external_id", externalId)
      .eq("action", eventType);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao processar webhook.";
    await service
      .from("payment_webhooks")
      .update({ error: message })
      .eq("external_id", externalId)
      .eq("action", eventType);
  }

  return NextResponse.json({ ok: true });
}
