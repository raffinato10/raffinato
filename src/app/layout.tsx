import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Usada apenas no título da seção "Nossas categorias" (home) — não altera a
// fonte padrão do restante do site, que continua em --font-sans (Inter).
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Raffinato",
    template: "%s | Raffinato",
  },
  description: "Loja premium com produtos de alta qualidade.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfairDisplay.variable}`}>
      <body className="bg-dark-bg text-dark-text antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
