import Link from "next/link";
import { MessageCircle, ShieldCheck, Truck, Award, ArrowRight, Star } from "lucide-react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { CategoryCircle } from "@/components/public/CategoryCircle";
import { ProductCard } from "@/components/public/ProductCard";
import { HeroBannerCarousel } from "@/components/public/HeroBannerCarousel";
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

const BENEFITS = [
  { icon: ShieldCheck, title: "Qualidade garantida", desc: "Produtos com procedência e qualidade verificada pela nossa equipe." },
  { icon: Truck, title: "Entrega discreta", desc: "Embalagem sem identificação do conteúdo em todo o Brasil." },
  { icon: MessageCircle, title: "Suporte via WhatsApp", desc: "Tire dúvidas diretamente com nossa equipe especializada." },
  { icon: Award, title: "Produtos premium", desc: "Seleção rigorosa dos melhores produtos do mercado." },
];

const HOW_TO_BUY = [
  { step: 1, title: "Escolha o produto", desc: "Navegue pelo catálogo e encontre o que você precisa." },
  { step: 2, title: "Adicione ao carrinho", desc: "Selecione a quantidade e adicione ao carrinho." },
  { step: 3, title: "Finalize o pedido", desc: "Preencha seus dados e escolha o método de entrega." },
  { step: 4, title: "Pague via Pix", desc: "Pague com Pix e economize. Aprovação imediata." },
];

export default async function HomePage() {
  let categories: Category[];
  let navCategories: Category[];
  let products: Product[];
  let banners: HomeBanner[] = [];
  let reviews: Review[] = [];

  // Banners e depoimentos carregam independentemente — falha em categorias não deve apagá-los
  try {
    banners = await getActiveBanners();
  } catch {
    banners = [];
  }

  try {
    reviews = await getActiveReviews();
  } catch {
    reviews = [];
  }

  try {
    [categories, products] = await Promise.all([
      dbGetFeaturedCategories(),
      dbGetFeaturedProducts(),
    ]);
  } catch {
    categories = mockGetFeaturedCategories();
    products = mockGetFeaturedProducts();
  }

  try {
    navCategories = await dbGetTopLevelCategories();
  } catch {
    navCategories = mockCategories.filter((c) => c.is_active && !c.parent_id);
  }

  return (
    <>
      <PublicNavbar categories={navCategories} />
      <main className="pt-24">

        {/* HERO — carrossel de banners ou hero estático como fallback */}
        {banners.length > 0 ? (
          <HeroBannerCarousel banners={banners} />
        ) : (
          <section className="relative min-h-[88vh] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-dark-bg via-dark-surface to-dark-bg" />
            <div
              className="absolute inset-0"
              style={{ background: "radial-gradient(ellipse at 65% 45%, rgba(201,168,76,0.12) 0%, transparent 60%)" }}
            />
            <Container className="relative z-10 text-center py-24">
              <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-8">
                <Star size={13} className="text-accent fill-accent" />
                <span className="text-xs font-semibold text-accent tracking-wide">
                  Produtos premium com qualidade garantida
                </span>
              </div>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-dark-text leading-tight mb-6 tracking-tight">
                O melhor em{" "}
                <span className="text-gradient-gold">moda premium</span>
                <br />
                <span className="text-dark-text/80">para você</span>
              </h1>
              <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
                Camisetas, polos e moletons selecionados com qualidade premium
                e entrega discreta em todo o Brasil.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="#categorias">
                  <Button variant="accent" size="lg">
                    Ver coleções
                    <ArrowRight size={18} />
                  </Button>
                </Link>
                <a href={generateStoreWhatsAppLink()} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg">
                    <MessageCircle size={18} />
                    Falar no WhatsApp
                  </Button>
                </a>
              </div>
            </Container>
          </section>
        )}

        {/* ── DIVISOR ───────────────────────────────────────── */}
        <div className="divider-gold" />

        {/* CATEGORIES — círculos em grid */}
        <section id="categorias" className="py-20 bg-dark-bg overflow-hidden">
          <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12 text-center">
              <span className="eyebrow-label mb-4 inline-flex">Coleções</span>
              <h2 className="text-2xl md:text-4xl font-bold text-dark-text tracking-tight mt-1">
                Nossas <span className="text-gradient-gold">categorias</span>
              </h2>
              <p className="text-sm text-muted mt-3">Explore nossa linha de produtos premium</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-8 md:gap-10 justify-items-center">
              {categories.map((cat) => (
                <CategoryCircle key={cat.id} category={cat} />
              ))}
            </div>
          </div>
        </section>

        {/* ── DIVISOR ───────────────────────────────────────── */}
        <div className="divider-gold" />

        {/* FEATURED PRODUCTS */}
        <section className="py-24 bg-dark-surface">
          <Container>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </Container>
        </section>

        {/* ── DIVISOR ───────────────────────────────────────── */}
        <div className="divider-gold" />

        {/* BENEFITS */}
        <section className="relative py-24 bg-dark-bg overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(201,168,76,0.05) 0%, transparent 65%)" }}
          />
          <Container className="relative">
            <SectionHeader eyebrow="Diferenciais" title="Por que nos escolher" align="center" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
              {BENEFITS.map((b) => (
                <div
                  key={b.title}
                  className="relative group text-center p-7 rounded-2xl bg-dark-surface border border-dark-border hover:border-accent/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(0,0,0,0.6)]"
                >
                  <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-accent/0 to-transparent group-hover:via-accent/50 transition-all duration-500" />
                  <div className="w-14 h-14 bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/15 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:shadow-[0_0_24px_rgba(201,168,76,0.2)] transition-all duration-300">
                    <b.icon size={24} className="text-accent" />
                  </div>
                  <h3 className="font-bold text-dark-text mb-2 text-sm tracking-wide">{b.title}</h3>
                  <p className="text-xs text-muted leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── DIVISOR ───────────────────────────────────────── */}
        <div className="divider-gold" />

        {/* HOW TO BUY */}
        <section className="py-24 bg-dark-surface">
          <Container>
            <SectionHeader eyebrow="Processo" title="Como comprar" align="center" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-14">
              {HOW_TO_BUY.map((s, i) => (
                <div key={s.step} className="text-center relative">
                  {i < HOW_TO_BUY.length - 1 && (
                    <div
                      className="hidden lg:block absolute top-6 left-[calc(50%+1.75rem)] right-0 h-px"
                      style={{ background: "linear-gradient(to right, rgba(201,168,76,0.4), rgba(201,168,76,0.05))" }}
                    />
                  )}
                  <div className="step-number mx-auto mb-5 relative z-10">{s.step}</div>
                  <h3 className="font-bold text-dark-text mb-2 text-sm tracking-wide">{s.title}</h3>
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
        <section className="relative py-24 bg-dark-bg overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(37,211,102,0.04) 0%, transparent 60%)" }}
          />
          <Container className="relative text-center">
            <div className="max-w-xl mx-auto">
              <div className="w-20 h-20 bg-whatsapp/10 border border-whatsapp/20 rounded-full flex items-center justify-center mx-auto mb-7 shadow-[0_0_40px_rgba(37,211,102,0.1)]">
                <MessageCircle size={36} className="text-whatsapp" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-dark-text mb-4 tracking-tight">
                Ainda tem dúvidas?
              </h2>
              <p className="text-muted mb-9 leading-relaxed">
                Nossa equipe está disponível para te ajudar com informações sobre os produtos,
                tamanhos e disponibilidade.
              </p>
              <a href={generateStoreWhatsAppLink()} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-whatsapp hover:bg-whatsapp-dark text-white border-0 shadow-[0_8px_32px_rgba(37,211,102,0.3)] hover:shadow-[0_12px_40px_rgba(37,211,102,0.4)]">
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
