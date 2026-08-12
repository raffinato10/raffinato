import type {
  PaymentProvider,
  CreatePreferenceInput,
  CreatePreferenceResult,
  PaymentVerificationResult,
  PaymentVerificationStatus,
} from "./types";

// Provider real — PYX Gate (https://www.pyxgate.com/developers/), Pix e
// cartão (com 3DS via SDK Zendry, ver checkout/page.tsx). Só entra em uso
// quando PYXGATE_SECRET_KEY está preenchido (ver getPaymentProvider em
// ./index.ts). Chave secreta gerada no painel da PYX Gate > Developers.
//
// ATENÇÃO — cartão: a API da PYX Gate exige que número, validade e CVV
// passem direto no corpo de POST /v1/payments — não existe tokenização
// client-side (tipo Stripe Elements/hosted fields). Isso coloca a loja em
// escopo PCI-DSS SAQ D; decisão consciente do time, não uma escolha técnica
// isolada. Os nomes dos campos abaixo dentro de `card`/`threeds_data` não
// estão documentados com precisão para a API (só para o SDK do browser) —
// foram inferidos a partir do `payment_form` do SDK Zendry. Confirme contra
// a conta real / suporte da PYX Gate antes de processar cartões em produção.

const PYX_API_BASE = "https://pyxgate-api.onrender.com/v1";

function getSecretKey(): string {
  const key = process.env.PYXGATE_SECRET_KEY;
  if (!key) throw new Error("PYXGATE_SECRET_KEY não configurado.");
  return key;
}

// A PYX Gate trabalha em centavos (integer); o resto do app trabalha em reais.
function toCents(total: number): number {
  return Math.round(total * 100);
}

function buildDocument(document?: string): string | undefined {
  if (!document) return undefined;
  const digits = document.replace(/\D/g, "");
  return digits || undefined;
}

function mapStatus(pyxStatus: string): PaymentVerificationStatus {
  switch (pyxStatus) {
    case "paid":
      return "approved";
    case "failed":
      return "rejected";
    case "expired":
      return "cancelled";
    default:
      // pending
      return "pending";
  }
}

interface PyxPaymentResponse {
  id: string;
  status: string;
  qr_code?: string;
  qr_code_base64?: string;
  paid_at?: string;
}

export const pyxgateProvider: PaymentProvider = {
  name: "pyxgate",

  async createPreference(input: CreatePreferenceInput): Promise<CreatePreferenceResult> {
    const paymentMethod = input.paymentMethod ?? "pix";
    const document = buildDocument(input.customerDocument);

    const body: Record<string, unknown> = {
      amount: toCents(input.total),
      payment_method: paymentMethod,
      customer: {
        name: input.customerName,
        email: input.customerEmail,
        ...(document ? { document } : {}),
      },
      metadata: { order_id: input.orderId, order_number: input.orderNumber },
    };

    if (paymentMethod === "card") {
      if (!input.card || !input.threeDsData) {
        throw new Error("Dados de cartão/3DS ausentes para pagamento com cartão.");
      }
      body.card = {
        pan: input.card.pan,
        expiry_month: input.card.expiryMonth,
        expiry_year: input.card.expiryYear,
        card_holder_name: input.card.cardHolderName,
        cvv: input.card.cvv,
      };
      body.threeds_data = {
        operation_session_id: input.threeDsData.operationSessionId,
        xid: input.threeDsData.xid,
        eci: input.threeDsData.eci,
        cavv: input.threeDsData.cavv,
        secure_version: input.threeDsData.secureVersion,
        directory_server_transaction_id: input.threeDsData.directoryServerTransactionId,
        three_ds_server_transaction_id: input.threeDsData.threeDsServerTransactionId,
      };
    }

    const res = await fetch(`${PYX_API_BASE}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getSecretKey()}`,
        // Chave de idempotência = orderId: um retry do checkout (ou da rota
        // create-preference) nunca gera uma segunda cobrança pro mesmo pedido.
        "Idempotency-Key": input.orderId,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`PYX Gate recusou a criação do pagamento (${res.status}): ${errorBody}`);
    }

    const payment = (await res.json()) as PyxPaymentResponse;

    return {
      checkoutUrl: `/pagamento/${input.orderId}`,
      externalId: payment.id,
      pixCode: payment.qr_code,
      pixQrBase64: payment.qr_code_base64,
      status: mapStatus(payment.status),
    };
  },

  async verifyPayment(externalId: string): Promise<PaymentVerificationResult> {
    const res = await fetch(`${PYX_API_BASE}/payments/${externalId}`, {
      headers: { Authorization: `Bearer ${getSecretKey()}` },
    });

    if (!res.ok) {
      throw new Error(`Erro ao consultar pagamento ${externalId} na PYX Gate (${res.status}).`);
    }

    const payment = (await res.json()) as PyxPaymentResponse;

    return {
      status: mapStatus(payment.status),
      paidAt: payment.paid_at,
    };
  },
};
