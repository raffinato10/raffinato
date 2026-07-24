import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Raffinato — Loja premium com produtos de alta qualidade";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const markData = await readFile(join(process.cwd(), "src/app/apple-icon.png"), "base64");
  const markSrc = `data:image/png;base64,${markData}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #161616 0%, #050505 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={markSrc} width={140} height={140} style={{ borderRadius: 28 }} />
        <div
          style={{
            marginTop: 36,
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: 10,
            color: "#e2c97a",
          }}
        >
          RAFFINATO
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 28,
            color: "#9a9a9a",
            letterSpacing: 1,
          }}
        >
          Loja premium com produtos de alta qualidade
        </div>
      </div>
    ),
    { ...size }
  );
}
