import { NextResponse } from "next/server";
import { isStubPaymentProvider } from "@/lib/payments";

// GET /api/payments/card/3ds-token — proxeia a busca do token de sessão 3DS
// da PYX Gate (GET /v1/card_authentications/token) pro browser, porque a
// secret key nunca pode ir ao client. Chamado pelo checkout antes de rodar
// o desafio 3DS do SDK Zendry, quando o cliente escolhe pagar com cartão.
export async function GET() {
  if (isStubPaymentProvider()) {
    return NextResponse.json(
      { error: "Pagamento com cartão indisponível — gateway de pagamento não configurado." },
      { status: 403 }
    );
  }

  const secretKey = process.env.PYXGATE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Pagamento com cartão indisponível." }, { status: 403 });
  }

  const res = await fetch("https://pyxgate-api.onrender.com/v1/card_authentications/token", {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Erro ao iniciar a autenticação do cartão." }, { status: 502 });
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    return NextResponse.json({ error: "Erro ao iniciar a autenticação do cartão." }, { status: 502 });
  }

  return NextResponse.json({ token: data.token });
}
