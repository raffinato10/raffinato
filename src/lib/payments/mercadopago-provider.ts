import type {
  PaymentProvider,
  CreatePreferenceInput,
  CreatePreferenceResult,
  PaymentVerificationResult,
  PaymentVerificationStatus,
} from "./types";

// Provider real — Mercado Pago, Pix via API de Pagamentos
// (https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post).
// Só entra em uso quando MERCADO_PAGO_ACCESS_TOKEN está preenchido (ver
// getPaymentProvider em ./index.ts). Token de produção em:
// https://www.mercadopago.com.br/developers/panel/app > Credenciais de produção.

const MP_API_BASE = "https://api.mercadopago.com";

function getToken(): string {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
  return token;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? fullName,
    lastName: parts.slice(1).join(" ") || parts[0] || fullName,
  };
}

function mapStatus(mpStatus: string): PaymentVerificationStatus {
  switch (mpStatus) {
    case "approved":
      return "approved";
    case "cancelled":
    case "refunded":
    case "charged_back":
      return "cancelled";
    case "rejected":
      return "rejected";
    default:
      // pending, in_process, authorized, in_mediation
      return "pending";
  }
}

// A Mercado Pago exige um tipo de documento junto do número — só recebemos
// CPF no checkout (pessoa física), mas cai pra CNPJ se vier com 14 dígitos.
function buildIdentification(document?: string): { type: string; number: string } | undefined {
  if (!document) return undefined;
  const digits = document.replace(/\D/g, "");
  if (!digits) return undefined;
  return { type: digits.length > 11 ? "CNPJ" : "CPF", number: digits };
}

interface MpCreatePaymentResponse {
  id: number;
  status: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
}

interface MpGetPaymentResponse {
  id: number;
  status: string;
  date_approved?: string | null;
}

export const mercadopagoProvider: PaymentProvider = {
  name: "mercadopago",

  async createPreference(input: CreatePreferenceInput): Promise<CreatePreferenceResult> {
    const { firstName, lastName } = splitName(input.customerName);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const identification = buildIdentification(input.customerDocument);

    const res = await fetch(`${MP_API_BASE}/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
        // Chave de idempotência = orderId: um retry do checkout (ou da rota
        // create-preference) nunca gera uma segunda cobrança pro mesmo pedido.
        "X-Idempotency-Key": input.orderId,
      },
      body: JSON.stringify({
        transaction_amount: input.total,
        description: `Pedido #${input.orderNumber}`,
        payment_method_id: "pix",
        external_reference: input.orderId,
        ...(appUrl ? { notification_url: `${appUrl}/api/payments/webhook` } : {}),
        payer: {
          email: input.customerEmail,
          first_name: firstName,
          last_name: lastName,
          ...(identification ? { identification } : {}),
        },
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`Mercado Pago recusou a criação do pagamento (${res.status}): ${errorBody}`);
    }

    const payment = (await res.json()) as MpCreatePaymentResponse;
    const transactionData = payment.point_of_interaction?.transaction_data;

    return {
      checkoutUrl: `/pagamento/${input.orderId}`,
      externalId: String(payment.id),
      pixCode: transactionData?.qr_code,
      pixQrBase64: transactionData?.qr_code_base64,
      externalCheckoutUrl: transactionData?.ticket_url,
    };
  },

  async verifyPayment(externalId: string): Promise<PaymentVerificationResult> {
    const res = await fetch(`${MP_API_BASE}/v1/payments/${externalId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (!res.ok) {
      throw new Error(`Erro ao consultar pagamento ${externalId} no Mercado Pago (${res.status}).`);
    }

    const payment = (await res.json()) as MpGetPaymentResponse;

    return {
      status: mapStatus(payment.status),
      paidAt: payment.date_approved ?? undefined,
    };
  },
};
