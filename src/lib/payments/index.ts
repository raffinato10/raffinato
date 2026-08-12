import type { PaymentProvider } from "./types";
import { stubPaymentProvider } from "./stub-provider";
import { pyxgateProvider } from "./pyxgate-provider";

// Fábrica do provider de pagamento ativo. Assim que PYXGATE_SECRET_KEY for
// preenchido, o checkout passa a usar a PYX Gate automaticamente — nada mais
// no app precisa mudar quando a chave real chegar, só preencher o .env.
export function getPaymentProvider(): PaymentProvider {
  if (process.env.PYXGATE_SECRET_KEY) return pyxgateProvider;
  return stubPaymentProvider;
}

export function isStubPaymentProvider(): boolean {
  return getPaymentProvider().name === "stub";
}

export type { PaymentProvider } from "./types";
