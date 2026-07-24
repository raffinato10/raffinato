export const STORE_WHATSAPP = "5585999823352";

interface WhatsAppOrderData {
  orderNumber: string;
  customerName: string;
  items: { name: string; quantity: number; unitPrice?: number }[];
  total: number;
  storePhone?: string;
}

interface WhatsAppSupportData {
  customerName?: string;
  productName?: string;
  storePhone?: string;
}

export const generateOrderWhatsAppLink = ({
  orderNumber,
  customerName,
  items,
  total,
  storePhone = STORE_WHATSAPP,
}: WhatsAppOrderData): string => {
  const itemsList = items
    .map((i) =>
      i.unitPrice !== undefined
        ? `• ${i.name} × ${i.quantity} (R$ ${i.unitPrice.toFixed(2).replace(".", ",")} cada)`
        : `• ${i.name} × ${i.quantity}`
    )
    .join("\n");
  const text = `Olá! Sou ${customerName} e fiz o pedido *${orderNumber}*.

${itemsList}

*Total: R$ ${total.toFixed(2).replace(".", ",")}*

Gostaria de mais informações sobre meu pedido.`;
  return `https://wa.me/${storePhone}?text=${encodeURIComponent(text)}`;
};

export const generateSupportWhatsAppLink = ({
  customerName,
  productName,
  storePhone = STORE_WHATSAPP,
}: WhatsAppSupportData): string => {
  const text = productName
    ? `Olá! ${customerName ? `Sou ${customerName} e t` : "T"}enho uma dúvida sobre o produto *${productName}*.`
    : `Olá! ${customerName ? `Sou ${customerName} e p` : "P"}reciso de ajuda.`;
  return `https://wa.me/${storePhone}?text=${encodeURIComponent(text)}`;
};

export const generateStatusWhatsAppLink = ({
  orderNumber,
  customerName,
  newStatus,
  storePhone = STORE_WHATSAPP,
}: {
  orderNumber: string;
  customerName: string;
  newStatus: string;
  storePhone?: string;
}): string => {
  const statusMessages: Record<string, string> = {
    payment_confirmed: `Olá ${customerName}! Confirmamos o pagamento do seu pedido *${orderNumber}*. Em breve vamos separar seu pedido! 📦`,
    awaiting_separation: `Olá ${customerName}! Seu pedido *${orderNumber}* está sendo separado! 🔄`,
    shipped: `Olá ${customerName}! Seu pedido *${orderNumber}* foi enviado! 🚚 Em breve você receberá o código de rastreamento.`,
    delivered: `Olá ${customerName}! Confirmamos a entrega do seu pedido *${orderNumber}*. Esperamos que goste! ✅`,
  };
  const text =
    statusMessages[newStatus] ||
    `Olá ${customerName}! Atualização sobre seu pedido *${orderNumber}*.`;
  return `https://wa.me/${storePhone}?text=${encodeURIComponent(text)}`;
};

export const generateStoreWhatsAppLink = (storePhone = STORE_WHATSAPP): string =>
  `https://wa.me/${storePhone}`;
