import type { Metadata } from "next";
import AcompanharPedidoClient from "./AcompanharPedidoClient";

export const metadata: Metadata = {
  title: "Acompanhar pedido",
  description: "Localize sua compra pelo número do pedido, CPF ou e-mail.",
};

export default function AcompanharPedidoPage() {
  return <AcompanharPedidoClient />;
}
