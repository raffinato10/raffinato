import type { ShippingOption } from "@/types";

export const mockShippingOptions: ShippingOption[] = [
  {
    code: "PAC",
    name: "PAC",
    carrier: "Correios",
    price: 18.90,
    delivery_days: 7,
    description: "Entrega econômica pelos Correios",
  },
  {
    code: "SEDEX",
    name: "SEDEX",
    carrier: "Correios",
    price: 34.50,
    delivery_days: 2,
    description: "Entrega expressa pelos Correios",
  },
  {
    code: "JADLOG-E",
    name: "Jadlog .E",
    carrier: "Jadlog",
    price: 24.90,
    delivery_days: 4,
    description: "Entrega econômica Jadlog",
  },
  {
    code: "TOTALEXPRESS",
    name: "Total Express",
    carrier: "Total Express",
    price: 28.00,
    delivery_days: 3,
    description: "Entrega rápida Total Express",
  },
];

export const getShippingForCep = (cep: string): ShippingOption[] => {
  // Mock: sempre retorna as opções, com variação por region
  const cleanCep = cep.replace(/\D/g, "");
  const prefix = parseInt(cleanCep.substring(0, 2));

  // Sul e Sudeste: frete menor
  if (prefix <= 39 || (prefix >= 80 && prefix <= 99)) {
    return mockShippingOptions;
  }
  // Norte, Nordeste, Centro-Oeste: frete maior
  return mockShippingOptions.map((opt) => ({
    ...opt,
    price: opt.price * 1.35,
    delivery_days: opt.delivery_days + 2,
  }));
};
