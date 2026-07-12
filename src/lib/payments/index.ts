import type { PaymentProvider } from "./types";
import { stubPaymentProvider } from "./stub-provider";
import { picpayProvider } from "./picpay-provider";
import { mercadopagoProvider } from "./mercadopago-provider";

// Fábrica do provider de pagamento ativo. Prioridade: Mercado Pago > PicPay >
// stub. Assim que MERCADO_PAGO_ACCESS_TOKEN for preenchido, o checkout passa
// a usar o Mercado Pago automaticamente — nada mais no app precisa mudar
// quando a chave real chegar, só preencher o .env.
export function getPaymentProvider(): PaymentProvider {
  if (process.env.MERCADO_PAGO_ACCESS_TOKEN) return mercadopagoProvider;
  if (process.env.PICPAY_TOKEN) return picpayProvider;
  return stubPaymentProvider;
}

export function isStubPaymentProvider(): boolean {
  return getPaymentProvider().name === "stub";
}

export type { PaymentProvider } from "./types";
