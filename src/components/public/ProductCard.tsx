"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, ArrowRight } from "lucide-react";
import type { Product, ProductVariant } from "@/types";
import { Badge } from "@/components/common/Badge";
import { formatCurrency } from "@/lib/formatters";
import { routes } from "@/lib/routes";
import { useCartStore } from "@/store/cart-store";
import { resolveBasePrice } from "@/lib/pricing";
import { ProductBadge } from "@/components/shared/ProductBadge";

interface ProductCardProps {
  product: Product;
  showCategory?: boolean;
}

export const ProductCard = ({ product, showCategory = false }: ProductCardProps) => {
  const addItem = useCartStore((s) => s.addItem);
  const variants = product.variants ?? [];
  const hasVariants = variants.length > 0;
  const [displayedVariant, setDisplayedVariant] = useState<ProductVariant | undefined>(variants[0]);
  const [isHovering, setIsHovering] = useState(false);

  const mainImage = product.media?.find((m) => m.is_main && m.type === "image");
  const variantMainUrl  = displayedVariant?.media.find((m) => m.is_main)?.url ?? displayedVariant?.media[0]?.url;
  const variantHoverUrl = displayedVariant?.media.find((m) => m.is_hover)?.url;
  const cardImageUrl = hasVariants ? variantMainUrl : mainImage?.url;
  const cardImageShown = isHovering && variantHoverUrl ? variantHoverUrl : cardImageUrl;
  // price_pix é sempre o preço de venda atual; price_promotional (quando ativo)
  // é o preço ANTERIOR, exibido riscado — nunca o inverso.
  const pixPrice = product.price_pix;
  const hasDiscount =
    product.promotional_active &&
    !!product.price_promotional &&
    product.price_promotional > pixPrice;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.availability === "out_of_stock") return;
    const baseUnitPrice = resolveBasePrice(product);
    addItem({
      product_id:     product.id,
      product_name:   product.name,
      product_slug:   product.slug,
      product_sku:    product.sku,
      product_image:  mainImage?.url,
      price_pix:      baseUnitPrice,
      base_price_pix: baseUnitPrice,
      price_tiers:    product.quantity_pricing_enabled ? product.price_tiers : undefined,
      price_card:     product.price_card,
      quantity:       1,
      track_stock:    product.track_stock,
      stock:          product.stock,
    });
  };

  return (
    <Link
      href={routes.produto(product.slug)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="group relative flex flex-col bg-dark-surface border border-dark-border rounded-xl overflow-hidden
        transition-all duration-300 ease-out
        hover:border-accent/30 hover:-translate-y-1.5
        hover:shadow-[0_24px_64px_rgba(0,0,0,0.55),_0_0_0_1px_rgba(201,168,76,0.1)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dark-bg"
    >
      {/* Topo com brilho dourado sutil no hover */}
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-accent/0 to-transparent group-hover:via-accent/40 transition-all duration-500 z-10" />

      {/* Image — proporção 4:5 para mais presença visual */}
      <div className="relative aspect-[4/5] bg-dark-alt overflow-hidden">
        {/* Selo/badge customizado — posição/tamanho livres, configurados no
            admin. Fica DENTRO da área da imagem (que tem overflow-hidden),
            então nunca pode visualmente "escapar" para a seção de texto. */}
        {product.badge_image_url && (
          <ProductBadge
            url={product.badge_image_url}
            posX={product.badge_position_x ?? 50}
            posY={product.badge_position_y ?? 50}
            widthPct={product.badge_width_pct ?? 25}
            className="z-30 pointer-events-none"
          />
        )}

        {cardImageShown ? (
          <Image
            src={cardImageShown}
            alt={mainImage?.alt_text || product.name}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover group-hover:scale-107 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted gap-3">
            <ShoppingBag size={44} strokeWidth={1} />
            <span className="text-xs text-muted/60">Sem imagem</span>
          </div>
        )}

        {/* Bolinhas de cor — trocam a imagem do card sem navegar */}
        {hasVariants && variants.length > 1 && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-20">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDisplayedVariant(v);
                }}
                title={v.color_name}
                aria-label={`Ver cor ${v.color_name}`}
                className={[
                  "w-4 h-4 rounded-full border transition-all",
                  v.id === displayedVariant?.id
                    ? "border-accent scale-125 shadow-[0_0_0_2px_rgba(201,168,76,0.3)]"
                    : "border-white/60 hover:scale-110",
                ].join(" ")}
                style={{ backgroundColor: v.color_hex }}
              />
            ))}
          </div>
        )}

        {/* Overlay gradiente inferior para legibilidade */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-surface/80 via-transparent to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {product.is_featured && (
            <Badge label="Destaque" variant="gold" size="sm" />
          )}
          {hasDiscount && (
            <Badge
              label={`-${Math.round(((product.price_promotional! - pixPrice) / product.price_promotional!) * 100)}%`}
              variant="discount"
              size="sm"
            />
          )}
        </div>

        {/* Availability overlay for out of stock */}
        {product.availability === "out_of_stock" && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
            <span className="text-white/90 text-sm font-semibold bg-dark-bg/90 px-4 py-2 rounded-xl border border-white/10">
              Indisponível
            </span>
          </div>
        )}

        {/* Low stock */}
        {product.availability === "low_stock" && (
          <div className="absolute bottom-3 left-3 z-10">
            <Badge label="Últimas unidades" variant="warning" size="sm" />
          </div>
        )}
      </div>

      {/* Content — sem descrição na frente do card: nome, preço, parcelamento
          e ação de carrinho compacta, para dar mais respiro à imagem */}
      <div className="flex flex-col flex-1 p-4 sm:p-5 gap-2">
        {showCategory && product.category && (
          <span className="text-[10px] text-accent/70 font-bold uppercase tracking-widest">
            {product.category.name}
          </span>
        )}

        <h3 className="text-sm font-semibold text-dark-text line-clamp-2 group-hover:text-accent transition-colors duration-200 leading-snug">
          {product.name}
        </h3>

        {/* Divisor sutil */}
        <div className="h-px bg-dark-border/60 my-0.5" />

        {/* Preço + ação — lado a lado, respiro maior, botão compacto */}
        <div className="flex items-end justify-between gap-3 mt-auto pt-1">
          <div className="space-y-0.5 min-w-0">
            {hasDiscount && (
              <span className="block text-[11px] text-muted line-through">
                de {formatCurrency(product.price_promotional!)}
              </span>
            )}
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-accent tracking-tight">
                {formatCurrency(pixPrice)}
              </span>
              <span className="text-[10px] text-muted font-medium">no Pix</span>
            </div>
            <p className="text-[11px] text-muted/70">
              ou {formatCurrency(product.price_card)} no cartão
            </p>
          </div>

          {/* CTA — produtos com variação não têm compra direta no card, já
              que cor e tamanho precisam ser escolhidos na página do produto;
              o card inteiro já leva para lá, então mostramos só uma seta. */}
          {!hasVariants ? (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={product.availability === "out_of_stock"}
              aria-label={
                product.availability === "out_of_stock"
                  ? "Produto indisponível"
                  : `Adicionar ${product.name} ao carrinho`
              }
              className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-accent text-dark-bg
                hover:bg-accent-light active:scale-95 disabled:opacity-40 disabled:pointer-events-none
                transition-all duration-200 shadow-[0_4px_16px_rgba(201,168,76,0.25)] hover:shadow-[0_6px_20px_rgba(201,168,76,0.4)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dark-surface"
            >
              <ShoppingBag size={16} />
            </button>
          ) : (
            <span
              aria-hidden="true"
              className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border border-dark-border-light text-muted
                group-hover:text-accent group-hover:border-accent/40 transition-colors duration-200"
            >
              <ArrowRight size={16} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};
