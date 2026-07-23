"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ShoppingBag, Menu, X, ChevronRight } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { routes } from "@/lib/routes";
import { generateStoreWhatsAppLink } from "@/lib/whatsapp";
import type { Category } from "@/types";

interface NavLink {
  label: string;
  href: string;
  external: boolean;
}

interface Props {
  categories: Category[];
}

export const PublicNavbar = ({ categories }: Props) => {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const itemCount = useCartStore((s) => s.getItemCount());
  const pathname  = usePathname();

  const navLinks: NavLink[] = [
    { label: "Início", href: routes.home, external: false },
    ...categories.map((cat) => ({
      label: cat.name,
      href: routes.categoria(cat.slug),
      external: false,
    })),
    { label: "Acompanhar Pedido", href: routes.acompanharPedido, external: false },
    { label: "Atendimento", href: generateStoreWhatsAppLink(), external: true },
  ];

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isActive = (href: string, external: boolean): boolean => {
    if (external) return false;
    if (href === routes.home) return pathname === routes.home;
    return pathname.startsWith(href);
  };

  const Logo = ({ className = "" }: { className?: string }) => (
    <Link href={routes.home} className={`flex items-center flex-shrink-0 ${className}`}>
      <Image
        src="/logo-raffinato-header.png"
        alt="Raffinato"
        width={752}
        height={234}
        priority
        className="h-9 sm:h-10 md:h-11 w-auto object-contain brightness-0 invert transition-transform duration-300 hover:scale-105"
      />
    </Link>
  );

  const CartButton = () => (
    <Link
      href={routes.carrinho}
      aria-label="Carrinho de compras"
      className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-dark-surface border border-dark-border text-dark-text/70 hover:text-accent hover:border-accent/50 hover:shadow-[0_0_16px_rgba(201,168,76,0.25)] transition-all duration-200"
    >
      <ShoppingBag size={19} />
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-2 min-w-[19px] h-[19px] px-1 bg-accent text-dark-bg text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
          {itemCount > 9 ? "9+" : itemCount}
        </span>
      )}
    </Link>
  );

  return (
    <>
      <header
        className={[
          "fixed top-0 left-0 right-0 z-40 transition-all duration-300 border-b",
          scrolled
            ? "bg-[#050505]/98 backdrop-blur-md border-accent/10 shadow-[0_4px_32px_rgba(0,0,0,0.8)]"
            : "bg-[#050505]/95 backdrop-blur-sm border-white/[0.05]",
        ].join(" ")}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-[1fr_auto_1fr] lg:grid-cols-[auto_1fr_auto] items-center h-[72px] lg:h-20">

            {/* ── Esquerda: hambúrguer (mobile/tablet) / Logo (desktop) ─── */}
            <div className="flex items-center justify-start">
              <button
                className="lg:hidden flex items-center justify-center w-11 h-11 -ml-2 rounded-xl text-dark-text/80 hover:text-accent hover:bg-dark-surface transition-all"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
                aria-expanded={menuOpen}
              >
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
              <Logo className="hidden lg:flex" />
            </div>

            {/* ── Centro: Logo (mobile/tablet) / Navegação (desktop) ── */}
            <div className="flex items-center justify-center min-w-0">
              <Logo className="lg:hidden" />
              <nav className="hidden lg:flex items-center gap-7 xl:gap-9">
                {navLinks.map((link) => {
                  const active = isActive(link.href, link.external);
                  const baseClass =
                    "relative text-[13px] font-semibold uppercase tracking-wider transition-colors duration-200 group pb-1";

                  if (link.external) {
                    return (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${baseClass} text-dark-text/75 hover:text-accent`}
                      >
                        {link.label}
                        <span className="absolute bottom-0 left-0 h-px w-0 rounded-full bg-accent transition-all duration-300 group-hover:w-full" />
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      className={`${baseClass} ${active ? "text-accent" : "text-dark-text/75 hover:text-accent"}`}
                    >
                      {link.label}
                      <span
                        className={[
                          "absolute bottom-0 left-0 h-px rounded-full bg-accent transition-all duration-300",
                          active ? "w-full" : "w-0 group-hover:w-full",
                        ].join(" ")}
                      />
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* ── Direita: Carrinho ────────────────────────────────── */}
            <div className="flex items-center justify-end">
              <CartButton />
            </div>
          </div>
        </div>
      </header>

      {/* ── Menu Mobile ──────────────────────────────────── */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 pt-[72px]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer */}
          <div className="relative bg-[#050505] border-b border-accent/10 shadow-2xl">
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              {navLinks.map((link) => {
                const active = isActive(link.href, link.external);

                if (link.external) {
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold text-dark-text/80 hover:bg-dark-alt hover:text-accent transition-colors"
                    >
                      {link.label}
                      <ChevronRight size={16} className="text-muted" />
                    </a>
                  );
                }

                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={[
                      "flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold transition-colors",
                      active
                        ? "bg-accent/10 text-accent border border-accent/20"
                        : "text-dark-text/80 hover:bg-dark-alt hover:text-accent",
                    ].join(" ")}
                  >
                    {link.label}
                    <ChevronRight
                      size={16}
                      className={active ? "text-accent" : "text-muted"}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
