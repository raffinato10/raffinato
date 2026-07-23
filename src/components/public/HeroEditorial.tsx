import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/common/Button";

// Hero estático editorial — usado como fallback quando não há banners
// cadastrados no admin (ver src/app/page.tsx). Altura fixa (nunca 100vh) para
// a primeira dobra aproveitar melhor o espaço, no padrão de loja de moda.
export const HeroEditorial = () => {
  return (
    <section className="relative h-[560px] overflow-hidden border-b border-white/[0.06]">
      {/* Fundo base — degradê arquitetônico escuro (preto/marrom) */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1c140f] via-[#0a0806] to-[#050505]" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(201,168,76,0.10) 0%, transparent 62%)" }}
      />

      {/* Composição: modelo masculino | texto | modelo feminino */}
      <div className="relative h-full flex flex-col sm:grid sm:grid-cols-[1fr_1.35fr_1fr] lg:grid-cols-[1fr_1.15fr_1fr]">

        {/* Modelos — linha superior no mobile, colunas laterais a partir do sm */}
        <div className="flex h-[46%] sm:h-full sm:contents">
          <div className="relative w-1/2 sm:w-auto sm:order-1 h-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/home/hero-masculino.webp"
              alt="Modelo vestindo peça masculina premium Raffinato"
              className="absolute inset-0 w-full h-full object-cover object-[center_20%] sm:object-[center_15%]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/25 sm:bg-gradient-to-r sm:from-transparent sm:via-black/10 sm:to-black/75" />
          </div>

          <div className="relative w-1/2 sm:w-auto sm:order-3 h-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/home/hero-feminino.webp"
              alt="Modelo vestindo peça feminina premium Raffinato"
              className="absolute inset-0 w-full h-full object-cover object-[center_18%] sm:object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/25 sm:bg-gradient-to-l sm:from-transparent sm:via-black/10 sm:to-black/75" />
          </div>
        </div>

        {/* Texto central */}
        <div className="relative sm:order-2 flex-1 sm:flex-auto flex items-center justify-center px-5 sm:px-6">
          <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/70 to-transparent sm:bg-none pointer-events-none" />
          <div className="relative z-10 text-center max-w-[280px] sm:max-w-xs md:max-w-sm py-6 sm:py-0">
            <span className="eyebrow-label mb-4 sm:mb-5 inline-flex">Moda Premium</span>

            <h1 className="font-serif text-[2.35rem] leading-[1.05] sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 sm:mb-5">
              <span className="text-dark-text">O Básico</span>
              <br />
              <span className="text-gradient-gold">Elegante</span>
            </h1>

            <p className="text-xs sm:text-sm text-muted mb-6 sm:mb-8 tracking-wide">
              Qualidade premium <span className="text-accent/60">•</span> Estilo{" "}
              <span className="text-accent/60">•</span> Confiança
            </p>

            <div className="flex flex-col gap-3 w-full sm:w-auto sm:inline-flex sm:flex-row">
              <Link href="#categorias" className="w-full sm:w-auto">
                <Button variant="accent" size="md" fullWidth className="sm:w-auto tracking-wide">
                  Ver Coleções
                </Button>
              </Link>
              <Link href="#destaques" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  rightIcon={<ArrowRight size={15} />}
                  className="sm:w-auto tracking-wide"
                >
                  Novidades
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
