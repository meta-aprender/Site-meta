"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  motion,
  AnimatePresence,
} from "framer-motion";

import Image from "next/image";
import Link from "next/link";

import {
  ArrowUpRight,
  Instagram,
} from "lucide-react";

import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: [
    "400",
    "500",
    "600",
    "700",
  ],
});

interface Space {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

export default function Showcase({
  spaces,
}: {
  spaces: Space[];
}) {
  const [
    showPreloader,
    setShowPreloader,
  ] = useState(true);

  /*
   * Mantemos o carregamento com o GIF
   * que já existia no site.
   */
  useEffect(() => {
    const timer =
      setTimeout(() => {
        setShowPreloader(false);
      }, 2000);

    return () =>
      clearTimeout(timer);
  }, []);

  return (
    <>
      {/* ======================================================
          PRELOADER
      ====================================================== */}
      <AnimatePresence>
        {showPreloader && (
          <motion.div
            initial={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            transition={{
              duration: 0.8,
              ease: "easeInOut",
            }}
            className="
              fixed
              inset-0
              z-[200]
              flex
              items-center
              justify-center
              bg-white
            "
          >
            <Image
              src="/logo.gif"
              alt="Carregando..."
              width={400}
              height={400}
              unoptimized
              priority
              className="
                w-[180px]
                md:w-[250px]
                h-auto
                object-contain
              "
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================
          SITE
      ====================================================== */}
      <div
        className={`
          min-h-screen
          bg-[#F5F5F3]
          text-[#111111]
          ${poppins.className}
        `}
      >
        {/* ====================================================
            CABEÇALHO
        ==================================================== */}
        <header
          className="
            w-full
            px-5
            sm:px-8
            lg:px-12
            xl:px-16
            py-5
            md:py-7
          "
        >
          <div
            className="
              max-w-[1500px]
              mx-auto
              flex
              items-center
              justify-between
              gap-6
            "
          >
            {/* LOGO */}
            <Link
              href="/"
              className="
                flex
                items-center
                shrink-0
              "
            >
              <Image
                src="/logo.png"
                alt="Meta Aprender"
                width={180}
                height={70}
                priority
                className="
                  w-[115px]
                  sm:w-[135px]
                  md:w-[155px]
                  h-auto
                  object-contain
                "
              />
            </Link>

            {/* AÇÕES */}
            <div
              className="
                flex
                items-center
                gap-2
                sm:gap-4
              "
            >
              <a
                href="https://instagram.com/metaaprender"
                target="_blank"
                rel="noreferrer"
                className="
                  w-10
                  h-10
                  flex
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-black/10
                  hover:bg-black
                  hover:text-white
                  transition-all
                "
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>

              <Link
                href="/admin/login"
                className="
                  h-10
                  flex
                  items-center
                  justify-center
                  px-4
                  sm:px-5
                  rounded-full
                  bg-black
                  text-white
                  text-xs
                  sm:text-sm
                  font-medium
                  hover:bg-black/80
                  transition-colors
                "
              >
                Plataforma
              </Link>
            </div>
          </div>
        </header>

        {/* ====================================================
            CONTEÚDO PRINCIPAL
        ==================================================== */}
        <main
          className="
            px-5
            sm:px-8
            lg:px-12
            xl:px-16
            pt-8
            md:pt-12
            pb-20
          "
        >
          <div
            className="
              max-w-[1500px]
              mx-auto
            "
          >
            {/* APRESENTAÇÃO */}
            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.7,
                delay: 0.15,
              }}
              className="
                mb-10
                md:mb-14
              "
            >
              <p
                className="
                  text-xs
                  md:text-sm
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-black/45
                  mb-4
                "
              >
                Programa Meta Aprender
              </p>

              <div
                className="
                  flex
                  flex-col
                  lg:flex-row
                  lg:items-end
                  lg:justify-between
                  gap-6
                "
              >
                <h1
                  className="
                    text-[2.5rem]
                    sm:text-5xl
                    md:text-6xl
                    xl:text-7xl
                    leading-[0.98]
                    font-semibold
                    tracking-[-0.05em]
                    max-w-4xl
                  "
                >
                  Todos pela aprendizagem
                  das crianças.
                </h1>

                <p
                  className="
                    text-sm
                    md:text-base
                    text-black/55
                    leading-relaxed
                    max-w-md
                    lg:text-right
                  "
                >
                  Escolha abaixo o espaço que
                  deseja acessar e explore os
                  materiais disponíveis.
                </p>
              </div>
            </motion.div>

            {/* ==================================================
                CARDS
            ================================================== */}
            {spaces.length > 0 ? (
              <div
                className="
                  grid
                  grid-cols-1
                  sm:grid-cols-2
                  lg:grid-cols-3
                  xl:grid-cols-4
                  gap-5
                  md:gap-6
                "
              >
                {spaces.map(
                  (
                    space,
                    index
                  ) => (
                    <motion.div
                      key={
                        space.id
                      }
                      initial={{
                        opacity: 0,
                        y: 30,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        duration: 0.55,
                        delay:
                          0.05 *
                          index,
                      }}
                    >
                      <Link
                        href={`/espacos/${space.slug}`}
                        className="
                          group
                          relative
                          block
                          overflow-hidden
                          rounded-[28px]
                          bg-[#161616]
                          aspect-[4/5]
                          shadow-sm
                          hover:shadow-2xl
                          hover:-translate-y-2
                          transition-all
                          duration-500
                        "
                      >
                        {/* IMAGEM */}
                        {space.imageUrl ? (
                          <img
                            src={
                              space.imageUrl
                            }
                            alt={
                              space.name
                            }
                            className="
                              absolute
                              inset-0
                              w-full
                              h-full
                              object-cover
                              transition-transform
                              duration-700
                              group-hover:scale-105
                            "
                          />
                        ) : (
                          <div
                            className="
                              absolute
                              inset-0
                              bg-gradient-to-br
                              from-[#253A73]
                              via-[#15244E]
                              to-[#071020]
                            "
                          />
                        )}

                        {/* SOMBRA SOBRE A IMAGEM */}
                        <div
                          className="
                            absolute
                            inset-0
                            bg-gradient-to-t
                            from-black/85
                            via-black/15
                            to-black/5
                          "
                        />

                        {/* NÚMERO */}
                        <div
                          className="
                            absolute
                            top-5
                            left-5
                            text-white/60
                            text-xs
                            font-medium
                            tracking-widest
                          "
                        >
                          {String(
                            index +
                              1
                          ).padStart(
                            2,
                            "0"
                          )}
                        </div>

                        {/* SETA */}
                        <div
                          className="
                            absolute
                            top-4
                            right-4
                            w-10
                            h-10
                            rounded-full
                            bg-white
                            text-black
                            flex
                            items-center
                            justify-center
                            translate-x-1
                            -translate-y-1
                            opacity-0
                            group-hover:opacity-100
                            group-hover:translate-x-0
                            group-hover:translate-y-0
                            transition-all
                            duration-300
                          "
                        >
                          <ArrowUpRight className="w-5 h-5" />
                        </div>

                        {/* NOME */}
                        <div
                          className="
                            absolute
                            left-0
                            right-0
                            bottom-0
                            p-5
                            md:p-6
                          "
                        >
                          <p
                            className="
                              text-[10px]
                              uppercase
                              tracking-[0.18em]
                              text-white/55
                              mb-2
                            "
                          >
                            Acessar materiais
                          </p>

                          <h2
                            className="
                              text-2xl
                              md:text-3xl
                              font-semibold
                              text-white
                              tracking-[-0.04em]
                              leading-tight
                            "
                          >
                            {
                              space.name
                            }
                          </h2>
                        </div>
                      </Link>
                    </motion.div>
                  )
                )}
              </div>
            ) : (
              <div
                className="
                  py-24
                  px-6
                  text-center
                  rounded-[28px]
                  border
                  border-dashed
                  border-black/15
                "
              >
                <h2
                  className="
                    text-xl
                    font-semibold
                    mb-2
                  "
                >
                  Nenhum espaço disponível.
                </h2>

                <p
                  className="
                    text-sm
                    text-black/50
                  "
                >
                  Os materiais serão disponibilizados em breve.
                </p>
              </div>
            )}

            {/* RODAPÉ */}
            <footer
              className="
                mt-20
                pt-8
                border-t
                border-black/10
                flex
                flex-col
                sm:flex-row
                justify-between
                gap-4
                text-xs
                text-black/45
              "
            >
              <p>
                META Aprender
              </p>

              <p>
                Todos Pela Aprendizagem das Crianças
              </p>
            </footer>
          </div>
        </main>
      </div>
    </>
  );
}