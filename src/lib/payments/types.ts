// Contrato comum a qualquer gateway de pagamento.
// O resto do app nunca importa um provider concreto — só essa interface,
// via getPaymentProvider() em src/lib/payments/index.ts.

export interface PaymentPreferenceItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

// Dados de cartão para pagamento direto (sem tokenização client-side — ver
// aviso de escopo PCI-DSS em pyxgate-provider.ts).
export interface CardPaymentInput {
  pan: string;
  expiryMonth: string;
  expiryYear: string;
  cardHolderName: string;
  cvv: string;
}

// Resultado do desafio 3DS rodado no browser pelo SDK Zendry, repassado ao
// provider para autorizar o pagamento com cartão.
export interface ThreeDsDataInput {
  operationSessionId: string;
  xid: string;
  eci: string;
  cavv: string;
  secureVersion: string;
  directoryServerTransactionId: string;
  threeDsServerTransactionId: string;
}

export interface CreatePreferenceInput {
  orderId: string;
  orderNumber: string;
  total: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerDocument?: string;
  items: PaymentPreferenceItem[];
  // Default "pix" quando omitido — providers que só suportam Pix podem ignorar.
  paymentMethod?: "pix" | "card";
  card?: CardPaymentInput;
  threeDsData?: ThreeDsDataInput;
}

export type PaymentVerificationStatus = "approved" | "pending" | "rejected" | "cancelled";

export interface CreatePreferenceResult {
  checkoutUrl: string;
  externalId: string;
  pixCode?: string;
  pixQrBase64?: string;
  externalCheckoutUrl?: string;
  // Pagamento com cartão pode resolver na hora (aprovado/recusado), diferente
  // do Pix que sempre nasce "pending" até o webhook confirmar.
  status?: PaymentVerificationStatus;
}

export interface PaymentVerificationResult {
  status: PaymentVerificationStatus;
  paidAt?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createPreference(input: CreatePreferenceInput): Promise<CreatePreferenceResult>;
  verifyPayment(externalId: string): Promise<PaymentVerificationResult>;
}
