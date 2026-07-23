import Link from "next/link";
import { MessageCircle, ShieldCheck, Truck, Award, ArrowRight, RotateCcw, QrCode } from "lucide-react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { CategoryShowcase } from "@/components/public/CategoryShowcase";
import { ProductCard } from "@/components/public/ProductCard";
import { HeroBannerCarousel } from "@/components/public/HeroBannerCarousel";
import { HeroEditorial } from "@/components/public/HeroEditorial";
import { Container, SectionHeader } from "@/components/common/SectionHeader";
import { Button } from "@/components/common/Button";
import { getFeaturedCategories as dbGetFeaturedCategories, getTopLevelCategories as dbGetTopLevelCategories } from "@/lib/db/categories";
import { getFeaturedProducts as dbGetFeaturedProducts } from "@/lib/db/products";
import { getActiveBanners } from "@/lib/db/banners";
import { getActiveReviews } from "@/lib/db/reviews";
import { getFeaturedCategories as mockGetFeaturedCategories, mockCategories } from "@/data/mock-categories";
import { getFeaturedProducts as mockGetFeaturedProducts } from "@/data/mock-products";
import { generateStoreWhatsAppLink } from "@/lib/whatsapp";
import { TestimonialsSection } from "@/components/public/TestimonialsSection";
import type { Category, Product, HomeBanner, Review } from "@/types";

// Faixa fina de benefícios, logo abaixo do hero — objetiva, sem texto longo.
const BENEFIT_STRIP = [
  { icon: Award,      title: "Qualidade Premium", desc: "Tecidos selecionados" },
  { icon: Truck,      title: "Entrega Rápida",    desc: "Para todo o Brasil" },
  { icon: RotateCcw,  title: "Troca Fácil",       desc: "Até 7 dias úteis" },
  { icon: QrCode,     title: "Pague com Pix",     desc: "5% de desconto" },
];

const BENEFITS = [
  { icon: ShieldCheck, title: "Qualidade garantida", desc: "Procedência e qualidade verificada." },
  { icon: Truck, title: "Entrega discreta", desc: "Embalagem sem identificação do conteúdo." },
  { icon: MessageCircle, title: "Suporte via WhatsApp", desc: "Dúvidas direto com nossa equipe." },
  { icon: Award, title: "Produtos premium", desc: "Seleção rigorosa do melhor do mercado." },
];

const HOW_TO_BUY = [
  { step: 1, title: "Escolha o produto", desc: "Navegue pelo catálogo e encontre o que você precisa." },
  { step: 2, title: "Adicione ao carrinho", desc: "Selecione a quantidade e adicione ao carrinho." },
  { step: 3, title: "Finalize o pedido", desc: "Preencha seus dados e escolha o método de entrega." },
  { step: 4, title: "Pague via Pix", desc: "Pague com Pix e economize. Aprovação imediata." },
];

export default async function HomePage() {
  // Todas as buscas são independentes entre si — rodam em paralelo, cada uma
  // com seu próprio fallback, para evitar um waterfall de requisições sequenciais.
  const [banners, reviews, [categories, products], navCategories] = await Promise.all([
    getActiveBanners().catch((): HomeBanner[] => []),
    getActiveReviews().catch((): Review[] => []),
    Promise.all([dbGetFeaturedCategories(), dbGetFeaturedProducts()]).catch(
      (): [Category[], Product[]] => [mockGetFeaturedCategories(), mockGetFeaturedProducts()]
    ),
    dbGetTopLevelCategories().catch((): Category[] =>
      mockCategories.filter((c) => c.is_active && !c.parent_id)
    ),
  ]);

  return (
    <>
      <PublicNavbar categories={navCategories} />
      <main className="pt-[72px] lg:pt-20">

        {/* HERO — carrossel de banners (admin) ou hero editorial como fallback */}
        {banners.length > 0 ? <HeroBannerCarousel banners={banners} /> : <HeroEditorial />}

        {/* FAIXA DE BENEFÍCIOS — logo abaixo do hero */}
        <section className="bg-dark-surface border-b border-dark-border/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-dark-border/60">
              {BENEFIT_STRIP.map((b) => (
                <div
                  key={b.title}
                  className="flex items-center justify-center md:justify-start gap-3 px-4 py-5 md:py-0 md:h-[100px]"
                >
                  <b.icon size={20} className="text-accent flex-shrink-0" />
                  <div className="text-left min-w-0">
                    <p className="text-xs md:text-sm font-bold text-dark-text leading-snug">
                      {b.title}
                    </p>
                    <p className="text-[11px] md:text-xs text-muted leading-snug">
                      {b.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CATEGORIES — cards editoriais grandes (Masculino/Feminino) */}
        <CategoryShowcase categories={categories} />

        {/* ── DIVISOR ───────────────────────────────────────── */}
        <div className="divider-gold" />

        {/* FEATURED PRODUCTS */}
        <section id="destaques" className="py-12 md:py-20 bg-dark-surface">
          <Container size="lg">
            <SectionHeader
              eyebrow="Destaques"
              title="Produtos em destaque"
              subtitle="Selecionados pela nossa equipe para você"
              action={
                <Link href="#categorias">
                  <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />}>
                    Ver todos
                  </Button>
                </Link>
              }
            />
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 mt-10">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </Container>
        </section>

        {/* ── DIVISOR ───────────────────────────────────────── */}
        <div className="divider-gold" />

        {/* DIFERENCIAIS */}
        <section className="relative py-12 md:py-20 bg-dark-bg overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(201,168,76,0.05) 0%, transparent 65%)" }}
          />
          <Container size="lg" className="relative">
            <SectionHeader eyebrow="Diferenciais" title="Por que nos escolher" align="center" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
              {BENEFITS.map((b) => (
                <div
                  key={b.title}
                  className="relative group text-center p-5 rounded-2xl bg-dark-surface border border-dark-border hover:border-accent/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
                >
                  <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-accent/0 to-transparent group-hover:via-accent/50 transition-all duration-500" />
                  <div className="w-11 h-11 bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/15 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:shadow-[0_0_20px_rgba(201,168,76,0.2)] transition-all duration-300">
                    <b.icon size={18} className="text-accent" />
                  </div>
                  <h3 className="font-bold text-dark-text mb-1.5 text-sm tracking-wide">{b.title}</h3>
                  <p className="text-xs text-muted leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── DIVISOR ───────────────────────────────────────── */}
        <div className="divider-gold" />

        {/* HOW TO BUY */}
        <section className="py-12 md:py-20 bg-dark-surface">
          <Container size="lg">
            <SectionHeader eyebrow="Processo" title="Como comprar" align="center" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mt-10">
              {HOW_TO_BUY.map((s, i) => (
                <div key={s.step} className="text-center relative">
                  {i < HOW_TO_BUY.length - 1 && (
                    <div
                      className="hidden lg:block absolute top-6 left-[calc(50%+1.75rem)] right-0 h-px"
                      style={{ background: "linear-gradient(to right, rgba(201,168,76,0.4), rgba(201,168,76,0.05))" }}
                    />
                  )}
                  <div className="step-number mx-auto mb-4 relative z-10">{s.step}</div>
                  <h3 className="font-bold text-dark-text mb-1.5 text-sm tracking-wide">{s.title}</h3>
                  <p className="text-xs text-muted leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── DIVISOR ───────────────────────────────────────── */}
        <div className="divider-gold" />

        {/* DEPOIMENTOS */}
        {reviews.length > 0 && <TestimonialsSection reviews={reviews} />}

        {reviews.length > 0 && <div className="divider-gold" />}

        {/* WHATSAPP CTA */}
        <section className="relative py-12 md:py-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-dark-bg via-[#07110c] to-dark-bg" />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(37,211,102,0.06) 0%, transparent 60%)" }}
          />
          <Container size="lg" className="relative text-center">
            <div className="max-w-xl mx-auto">
              <div className="w-16 h-16 bg-whatsapp/10 border border-whatsapp/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageCircle size={30} className="text-whatsapp" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-dark-text mb-3 tracking-tight">
                Ainda tem dúvidas?
              </h2>
              <p className="text-sm text-muted mb-8 leading-relaxed">
                Nossa equipe está disponível para te ajudar com informações sobre os produtos,
                tamanhos e disponibilidade.
              </p>
              <a href={generateStoreWhatsAppLink()} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-whatsapp hover:bg-whatsapp-dark text-white border-0 shadow-[0_6px_20px_rgba(37,211,102,0.2)] hover:shadow-[0_8px_28px_rgba(37,211,102,0.3)]">
                  <MessageCircle size={20} />
                  Falar com a equipe agora
                </Button>
              </a>
            </div>
          </Container>
        </section>

      </main>
      <PublicFooter categories={navCategories} />
      <WhatsAppButton />
    </>
  );
}
