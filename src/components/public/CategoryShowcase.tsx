import React from "react";
import Link from "next/link";
import { ArrowRight, Diamond } from "lucide-react";
import type { Category } from "@/types";
import { routes } from "@/lib/routes";

interface CategoryShowcaseProps {
  categories: Category[];
}

// Conteúdo editorial fixo por categoria (imagem local + título/descrição
// premium — título em capitalização normal, não a caixa alta salva no banco).
// Categorias sem entrada aqui caem no fallback (name/image_url/short_description
// vindos do banco) — nunca quebra se uma nova categoria for adicionada.
const SHOWCASE_CONTENT: Record<string, { title: string; image: string; description: string }> = {
  masculino: {
    title: "Masculino",
    image: "/images/categories/masculino-premium.webp",
    description: "Peças sofisticadas para o dia a dia.",
  },
  feminino: {
    title: "Feminino",
    image: "/images/categories/feminino-premium.webp",
    description: "Elegância e estilo atemporal.",
  },
};

export const CategoryShowcase = ({ categories }: CategoryShowcaseProps) => {
  if (categories.length === 0) return null;

  return (
    <section id="categorias" className="py-12 md:py-20 bg-dark-bg overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Cabeçalho ------------------------------------------------------ */}
        <div className="mb-12 sm:mb-16 flex flex-col items-center text-center">
          <span className="eyebrow-label mb-4">Coleções</span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            <span className="text-dark-text">Nossas </span>
            <span className="text-gradient-gold">categorias</span>
          </h2>

          {/* Divisor decorativo: linha — losango — linha */}
          <div className="flex items-center gap-3 mt-5 mb-6" aria-hidden="true">
            <span className="h-px w-10 sm:w-14 bg-gradient-to-r from-transparent to-accent/60" />
            <Diamond size={9} className="text-accent fill-accent" />
            <span className="h-px w-10 sm:w-14 bg-gradient-to-l from-transparent to-accent/60" />
          </div>

          <p className="text-sm sm:text-base text-muted max-w-xl leading-relaxed">
            Explore nossas coleções exclusivas, feitas para quem valoriza qualidade,
            estilo e sofisticação em cada detalhe.
          </p>
        </div>

        {/* Cards ----------------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((cat) => {
            const content = SHOWCASE_CONTENT[cat.slug];
            const title = content?.title ?? cat.name;
            const image = content?.image ?? cat.image_url ?? cat.first_product_image_url;
            const description = content?.description ?? cat.short_description;

            return (
              <Link
                key={cat.id}
                href={routes.categoria(cat.slug)}
                className="
                  group relative flex items-end overflow-hidden rounded-2xl
                  h-[300px] sm:h-[340px] md:h-[460px] lg:h-[500px]
                  border border-accent/20
                  shadow-[0_20px_56px_rgba(0,0,0,0.5)]
                  transition-all duration-500 ease-out
                  hover:border-accent/50
                  hover:shadow-[0_24px_64px_rgba(0,0,0,0.6),0_0_32px_rgba(201,168,76,0.12)]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dark-bg
                "
              >
                {/* Imagem de fundo */}
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt={`Coleção ${title} Raffinato`}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-dark-alt" />
                )}

                {/* Overlay em degradê — escurece a base e as laterais, sem apagar a imagem */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/25" />

                {/* Conteúdo */}
                <div className="relative z-10 p-6 sm:p-8 md:p-9 w-full">
                  <span className="inline-block text-[11px] font-bold tracking-[0.18em] uppercase text-accent mb-2">
                    Coleção
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
                    {title}
                  </h3>
                  {description && (
                    <p className="text-sm sm:text-base text-white/75 leading-relaxed mb-4 max-w-xs">
                      {description}
                    </p>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-light">
                    Explorar coleção
                    <ArrowRight
                      size={15}
                      className="transition-transform duration-300 ease-out group-hover:translate-x-1"
                    />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};
