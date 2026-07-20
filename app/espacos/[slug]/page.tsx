import { prisma } from "@/app/lib/prisma";

import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";

import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  Home,
} from "lucide-react";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;

  searchParams: Promise<{
    folder?: string;
  }>;
}

interface FolderData {
  id: string;
  title: string;
  parentId: string | null;
}

function formatBytes(
  bytes: number
) {
  if (!bytes) {
    return "";
  }

  const sizes = [
    "Bytes",
    "KB",
    "MB",
    "GB",
  ];

  const index = Math.floor(
    Math.log(bytes) /
      Math.log(1024)
  );

  return (
    (
      bytes /
      Math.pow(1024, index)
    ).toFixed(1) +
    " " +
    sizes[index]
  );
}

export default async function SpacePage(
  props: PageProps
) {
  const [
    params,
    searchParams,
  ] = await Promise.all([
    props.params,
    props.searchParams,
  ]);

  /*
   * Busca o espaço pelo slug.
   *
   * Espaços inativos não ficam
   * disponíveis publicamente.
   */
  const space =
    await prisma.space.findFirst({
      where: {
        slug: params.slug,
        active: true,
      },

      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
      },
    });

  if (!space) {
    notFound();
  }

  const requestedFolderId =
    searchParams.folder || null;

  let currentFolder:
    | FolderData
    | null = null;

  /*
   * Se alguém informar uma pasta
   * na URL, verificamos se ela
   * realmente pertence ao espaço.
   */
  if (requestedFolderId) {
    currentFolder =
      await prisma.material.findFirst({
        where: {
          id: requestedFolderId,
          type: "FOLDER",
          spaceId: space.id,
        },

        select: {
          id: true,
          title: true,
          parentId: true,
        },
      });

    /*
     * Pasta inválida:
     * volta para a raiz do espaço.
     */
    if (!currentFolder) {
      redirect(
        `/espacos/${space.slug}`
      );
    }
  }

  /*
   * Busca os materiais da pasta
   * atual ou da raiz do espaço.
   */
  const materials =
    await prisma.material.findMany({
      where: {
        spaceId: space.id,
        parentId:
          currentFolder?.id ||
          null,
      },
    });

  /*
   * Pastas primeiro.
   * Links depois.
   * Arquivos por último.
   */
  const sortedMaterials = [
    ...materials,
  ].sort((a, b) => {
    const getPriority = (
      type: string
    ) => {
      if (type === "FOLDER") {
        return 0;
      }

      if (type === "LINK") {
        return 1;
      }

      return 2;
    };

    const priorityDifference =
      getPriority(a.type) -
      getPriority(b.type);

    if (
      priorityDifference !== 0
    ) {
      return priorityDifference;
    }

    return a.title.localeCompare(
      b.title,
      "pt-BR"
    );
  });

  /*
   * Monta os breadcrumbs.
   *
   * Exemplo:
   *
   * 1º Ano
   *   > Português
   *     > Atividades
   */
  const breadcrumbs:
    FolderData[] = [];

  if (currentFolder) {
    let folder:
      | FolderData
      | null =
      currentFolder;

    const visited =
      new Set<string>();

    while (
      folder &&
      !visited.has(folder.id)
    ) {
      visited.add(folder.id);

      breadcrumbs.unshift(
        folder
      );

      if (!folder.parentId) {
        break;
      }

      folder =
        await prisma.material.findFirst({
          where: {
            id: folder.parentId,
            type: "FOLDER",
            spaceId: space.id,
          },

          select: {
            id: true,
            title: true,
            parentId: true,
          },
        });
    }
  }

  const backHref =
    currentFolder
      ? currentFolder.parentId
        ? `/espacos/${space.slug}?folder=${currentFolder.parentId}`
        : `/espacos/${space.slug}`
      : "/";

  return (
    <div className="min-h-screen bg-[#F5F5F3] text-[#111111]">

      {/* ====================================================
          CABEÇALHO
      ==================================================== */}
      <header
        className="
          px-5
          sm:px-8
          lg:px-12
          xl:px-16
          py-5
          border-b
          border-black/5
          bg-[#F5F5F3]/90
          backdrop-blur-md
          sticky
          top-0
          z-50
        "
      >
        <div
          className="
            max-w-[1500px]
            mx-auto
            flex
            items-center
            justify-between
            gap-5
          "
        >
          <Link
            href="/"
            className="
              font-bold
              text-xl
              tracking-[-0.04em]
            "
          >
            META Aprender
          </Link>

          <Link
            href="/"
            className="
              flex
              items-center
              gap-2
              text-sm
              font-medium
              text-black/60
              hover:text-black
              transition-colors
            "
          >
            <ArrowLeft className="w-4 h-4" />

            Voltar aos espaços
          </Link>
        </div>
      </header>

      {/* ====================================================
          HERO DO ESPAÇO
      ==================================================== */}
      <section
        className="
          px-5
          sm:px-8
          lg:px-12
          xl:px-16
          pt-10
          md:pt-16
        "
      >
        <div
          className="
            max-w-[1500px]
            mx-auto
          "
        >
          <div
            className="
              relative
              overflow-hidden
              min-h-[260px]
              md:min-h-[340px]
              rounded-[30px]
              md:rounded-[40px]
              bg-[#101828]
              text-white
              flex
              items-end
              p-7
              md:p-12
            "
          >
            {/* IMAGEM DO CARD */}
            {space.imageUrl && (
              <img
                src={
                  space.imageUrl
                }
                alt=""
                className="
                  absolute
                  inset-0
                  w-full
                  h-full
                  object-cover
                "
              />
            )}

            {/* ESCURECIMENTO */}
            <div
              className="
                absolute
                inset-0
                bg-gradient-to-r
                from-black/85
                via-black/55
                to-black/20
              "
            />

            <div
              className="
                relative
                z-10
                max-w-3xl
              "
            >
              <p
                className="
                  text-xs
                  uppercase
                  tracking-[0.2em]
                  text-white/60
                  font-semibold
                  mb-4
                "
              >
                Programa Meta Aprender
              </p>

              <h1
                className="
                  text-4xl
                  sm:text-5xl
                  md:text-6xl
                  font-bold
                  tracking-[-0.05em]
                "
              >
                {space.name}
              </h1>

              <p
                className="
                  text-sm
                  md:text-base
                  text-white/65
                  mt-5
                  max-w-xl
                "
              >
                Explore os materiais,
                documentos e recursos
                disponíveis neste espaço.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================
          MATERIAIS
      ==================================================== */}
      <main
        className="
          px-5
          sm:px-8
          lg:px-12
          xl:px-16
          py-10
          md:py-14
          pb-24
        "
      >
        <div
          className="
            max-w-[1500px]
            mx-auto
          "
        >

          {/* NAVEGAÇÃO */}
          <div
            className="
              flex
              flex-col
              lg:flex-row
              lg:items-center
              lg:justify-between
              gap-5
              mb-9
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                flex-wrap
                text-sm
              "
            >
              <Link
                href="/"
                className="
                  w-8
                  h-8
                  rounded-full
                  bg-white
                  border
                  border-black/10
                  flex
                  items-center
                  justify-center
                  hover:bg-black
                  hover:text-white
                  transition-all
                "
              >
                <Home className="w-4 h-4" />
              </Link>

              <span className="text-black/25">
                /
              </span>

              <Link
                href={`/espacos/${space.slug}`}
                className="
                  font-semibold
                  hover:text-[#2563EB]
                "
              >
                {space.name}
              </Link>

              {breadcrumbs.map(
                (
                  folder,
                  index
                ) => (
                  <div
                    key={
                      folder.id
                    }
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <span className="text-black/25">
                      /
                    </span>

                    <Link
                      href={`/espacos/${space.slug}?folder=${folder.id}`}
                      className={
                        index ===
                        breadcrumbs.length -
                          1
                          ? "font-semibold text-black"
                          : "text-black/50 hover:text-black"
                      }
                    >
                      {
                        folder.title
                      }
                    </Link>
                  </div>
                )
              )}
            </div>

            {currentFolder && (
              <Link
                href={backHref}
                className="
                  inline-flex
                  items-center
                  gap-2
                  text-sm
                  font-medium
                  px-4
                  py-2
                  rounded-full
                  bg-white
                  border
                  border-black/10
                  hover:border-black/30
                  transition-colors
                  w-fit
                "
              >
                <ArrowLeft className="w-4 h-4" />

                Voltar uma pasta
              </Link>
            )}
          </div>

          {/* TÍTULO DA PASTA */}
          <div className="mb-8">
            <p
              className="
                text-xs
                uppercase
                tracking-[0.18em]
                text-black/40
                font-semibold
                mb-2
              "
            >
              Materiais
            </p>

            <h2
              className="
                text-3xl
                md:text-4xl
                font-bold
                tracking-[-0.04em]
              "
            >
              {currentFolder
                ? currentFolder.title
                : "Todos os materiais"}
            </h2>
          </div>

          {/* LISTA VAZIA */}
          {sortedMaterials.length ===
          0 ? (
            <div
              className="
                min-h-[300px]
                rounded-[30px]
                border
                border-dashed
                border-black/15
                flex
                flex-col
                items-center
                justify-center
                text-center
                p-8
              "
            >
              <FolderOpen
                className="
                  w-14
                  h-14
                  text-black/15
                  mb-5
                "
              />

              <h3
                className="
                  text-xl
                  font-semibold
                  mb-2
                "
              >
                Nenhum material disponível ainda.
              </h3>

              <p
                className="
                  text-sm
                  text-black/45
                "
              >
                Os conteúdos deste espaço
                serão adicionados em breve.
              </p>
            </div>
          ) : (

            /* GRID */
            <div
              className="
                grid
                grid-cols-1
                md:grid-cols-2
                xl:grid-cols-3
                gap-4
              "
            >
              {sortedMaterials.map(
                (item) => {

                  /*
                   * ================================
                   * PASTA
                   * ================================
                   */
                  if (
                    item.type ===
                    "FOLDER"
                  ) {
                    return (
                      <Link
                        key={
                          item.id
                        }
                        href={`/espacos/${space.slug}?folder=${item.id}`}
                        className="
                          group
                          min-h-[160px]
                          rounded-[24px]
                          bg-white
                          border
                          border-black/5
                          p-6
                          flex
                          flex-col
                          justify-between
                          hover:border-[#2563EB]/30
                          hover:shadow-xl
                          hover:-translate-y-1
                          transition-all
                        "
                      >
                        <div
                          className="
                            flex
                            items-start
                            justify-between
                          "
                        >
                          <div
                            className="
                              w-12
                              h-12
                              rounded-2xl
                              bg-[#2563EB]/10
                              flex
                              items-center
                              justify-center
                            "
                          >
                            <Folder
                              className="
                                w-6
                                h-6
                                text-[#2563EB]
                              "
                            />
                          </div>

                          <ArrowUpRight
                            className="
                              w-5
                              h-5
                              text-black/20
                              group-hover:text-black
                              transition-colors
                            "
                          />
                        </div>

                        <div>
                          <p
                            className="
                              text-[10px]
                              uppercase
                              tracking-widest
                              text-black/35
                              mb-2
                            "
                          >
                            Pasta
                          </p>

                          <h3
                            className="
                              text-xl
                              font-semibold
                              tracking-[-0.03em]
                            "
                          >
                            {item.title}
                          </h3>
                        </div>
                      </Link>
                    );
                  }

                  /*
                   * ================================
                   * LINK EXTERNO
                   * ================================
                   */
                  if (
                    item.type ===
                    "LINK"
                  ) {
                    return (
                      <a
                        key={
                          item.id
                        }
                        href={
                          item.fileUrl ||
                          "#"
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="
                          group
                          min-h-[160px]
                          rounded-[24px]
                          bg-white
                          border
                          border-black/5
                          p-6
                          flex
                          flex-col
                          justify-between
                          hover:border-[#10B981]/30
                          hover:shadow-xl
                          hover:-translate-y-1
                          transition-all
                        "
                      >
                        <div
                          className="
                            flex
                            items-start
                            justify-between
                          "
                        >
                          <div
                            className="
                              w-12
                              h-12
                              rounded-2xl
                              bg-[#10B981]/10
                              flex
                              items-center
                              justify-center
                            "
                          >
                            <ExternalLink
                              className="
                                w-6
                                h-6
                                text-[#10B981]
                              "
                            />
                          </div>

                          <ArrowUpRight
                            className="
                              w-5
                              h-5
                              text-black/20
                              group-hover:text-black
                            "
                          />
                        </div>

                        <div>
                          <p
                            className="
                              text-[10px]
                              uppercase
                              tracking-widest
                              text-black/35
                              mb-2
                            "
                          >
                            Link
                          </p>

                          <h3
                            className="
                              text-xl
                              font-semibold
                              tracking-[-0.03em]
                            "
                          >
                            {item.title}
                          </h3>
                        </div>
                      </a>
                    );
                  }

                  /*
                   * ================================
                   * ARQUIVO
                   * ================================
                   */
                  const fileHref =
                    item.fileUrl
                      ? `/api/download?path=${encodeURIComponent(
                          item.fileUrl
                        )}&view=true`
                      : "#";

                  return (
                    <a
                      key={
                        item.id
                      }
                      href={
                        fileHref
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="
                        group
                        min-h-[160px]
                        rounded-[24px]
                        bg-white
                        border
                        border-black/5
                        p-6
                        flex
                        flex-col
                        justify-between
                        hover:border-black/20
                        hover:shadow-xl
                        hover:-translate-y-1
                        transition-all
                      "
                    >
                      <div
                        className="
                          flex
                          items-start
                          justify-between
                        "
                      >
                        <div
                          className="
                            w-12
                            h-12
                            rounded-2xl
                            bg-black/5
                            flex
                            items-center
                            justify-center
                          "
                        >
                          <FileText
                            className="
                              w-6
                              h-6
                              text-black/60
                            "
                          />
                        </div>

                        <Download
                          className="
                            w-5
                            h-5
                            text-black/20
                            group-hover:text-black
                            transition-colors
                          "
                        />
                      </div>

                      <div>
                        <div
                          className="
                            flex
                            items-center
                            gap-2
                            mb-2
                          "
                        >
                          <span
                            className="
                              text-[10px]
                              font-bold
                              uppercase
                              tracking-widest
                              text-black/35
                            "
                          >
                            {item.type}
                          </span>

                          {item.size >
                            0 && (
                            <span
                              className="
                                text-[10px]
                                text-black/30
                              "
                            >
                              •
                            </span>
                          )}

                          {item.size >
                            0 && (
                            <span
                              className="
                                text-[10px]
                                text-black/35
                              "
                            >
                              {formatBytes(
                                item.size
                              )}
                            </span>
                          )}
                        </div>

                        <h3
                          className="
                            text-lg
                            font-semibold
                            tracking-[-0.02em]
                            line-clamp-2
                          "
                        >
                          {item.title}
                        </h3>
                      </div>
                    </a>
                  );
                }
              )}
            </div>
          )}

        </div>
      </main>

    </div>
  );
}