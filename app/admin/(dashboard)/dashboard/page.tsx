import { prisma } from "../../../lib/prisma";
import { getServerSession } from "next-auth";
import {
  FolderPlus,
  FolderOpen,
  ArrowLeft,
  Home,
  Link as LinkIcon,
} from "lucide-react";
import { createFolder, createLink } from "@/app/actions";
import { authOptions } from "@/app/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import UploadForm from "./UploadForm";
import InteractiveFileList from "./InteractiveFileList";

interface PageProps {
  searchParams: Promise<{
    folder?: string;
    space?: string;
  }>;
}

export default async function DashboardPage(props: PageProps) {
  const session = await getServerSession(authOptions);
  const params = await props.searchParams;

  if (!session?.user?.email) {
    redirect("/admin/login");
  }

  const loggedUser = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (!loggedUser) {
    redirect("/admin/login");
  }

  const isAdmin = loggedUser.role === "ADMIN";

  const currentFolderId = params.folder || null;
  const selectedSpaceId = params.space || null;

  /*
   * Se alguém tentar acessar uma pasta sem informar
   * a qual espaço ela pertence, voltamos para a raiz.
   */
  if (currentFolderId && !selectedSpaceId) {
    redirect("/admin/dashboard");
  }

  /*
   * ADMIN vê todos os espaços ativos.
   * USER vê somente os espaços aos quais possui acesso.
   */
  const accessibleSpaces = await prisma.space.findMany({
    where: {
      active: true,
      ...(isAdmin
        ? {}
        : {
            userAccesses: {
              some: {
                userId: loggedUser.id,
              },
            },
          }),
    },
    orderBy: [
      {
        displayOrder: "asc",
      },
      {
        name: "asc",
      },
    ],
  });

  /*
   * Nenhum espaço selecionado:
   * mostramos a lista de espaços disponíveis.
   */
  if (!selectedSpaceId) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center gap-4 bg-[#1E293B] p-4 rounded-xl border border-white/5">
          <div className="p-2 bg-vibrantPurple/20 rounded-lg">
            <Home className="w-5 h-5 text-vibrantPurple" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-white">
              Espaços
            </h1>

            <p className="text-xs text-gray-400">
              Escolha um espaço para gerenciar os materiais
            </p>
          </div>
        </div>

        {accessibleSpaces.length === 0 ? (
          <div className="py-12 text-center text-gray-500 border border-dashed border-gray-700 rounded-xl">
            Você ainda não possui nenhum espaço disponível.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accessibleSpaces.map((space) => (
              <Link
                key={space.id}
                href={`/admin/dashboard?space=${space.id}`}
                className="bg-[#1E293B] border border-white/5 p-6 rounded-xl flex items-center gap-4 hover:border-cyanBright/50 hover:-translate-y-1 transition-all"
              >
                <div className="bg-cyanBright/10 p-3 rounded-full">
                  <FolderOpen className="w-6 h-6 text-cyanBright" />
                </div>

                <div className="min-w-0">
                  <h3 className="font-bold text-white truncate">
                    {space.name}
                  </h3>

                  <p className="text-xs text-gray-500">
                    Gerenciar materiais
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  /*
   * Confirma que o usuário realmente pode acessar
   * o espaço informado pela URL.
   */
  const selectedSpace = accessibleSpaces.find(
    (space) => space.id === selectedSpaceId
  );

  if (!selectedSpace) {
    redirect("/admin/dashboard");
  }

  /*
   * Se estamos dentro de uma pasta, validamos:
   *
   * 1. se ela existe;
   * 2. se realmente é uma pasta;
   * 3. se pertence ao espaço atual.
   */
  let currentFolderName = selectedSpace.name;
  let parentOfCurrent: string | null = null;

  if (currentFolderId) {
    const currentFolder = await prisma.material.findUnique({
      where: {
        id: currentFolderId,
      },
      select: {
        id: true,
        title: true,
        type: true,
        parentId: true,
        spaceId: true,
      },
    });

    if (
      !currentFolder ||
      currentFolder.type !== "FOLDER" ||
      currentFolder.spaceId !== selectedSpace.id
    ) {
      redirect(
        `/admin/dashboard?space=${selectedSpace.id}`
      );
    }

    currentFolderName = currentFolder.title;
    parentOfCurrent = currentFolder.parentId;
  }

  /*
   * Busca somente materiais pertencentes ao espaço.
   */
  const materials = await prisma.material.findMany({
    where: {
      spaceId: selectedSpace.id,
      parentId: currentFolderId,
    },
  });

  const sortedMaterials = materials.sort((a, b) => {
    if (
      a.type === "FOLDER" &&
      b.type !== "FOLDER"
    ) {
      return -1;
    }

    if (
      a.type !== "FOLDER" &&
      b.type === "FOLDER"
    ) {
      return 1;
    }

    if (
      a.type === "LINK" &&
      b.type !== "LINK"
    ) {
      return -1;
    }

    if (
      a.type !== "LINK" &&
      b.type === "LINK"
    ) {
      return 1;
    }

    return a.title.localeCompare(
      b.title,
      "pt-BR"
    );
  });

  /*
   * Pastas disponíveis para o botão "Mover".
   * Somente pastas do MESMO espaço.
   */
  const allFolders = await prisma.material.findMany({
    where: {
      spaceId: selectedSpace.id,
      type: "FOLDER",
      id: {
        not: currentFolderId || "",
      },
    },
  });

  const backHref = currentFolderId
    ? `/admin/dashboard?space=${selectedSpace.id}${
        parentOfCurrent
          ? `&folder=${parentOfCurrent}`
          : ""
      }`
    : "/admin/dashboard";

  return (
    <div className="space-y-6 pb-20">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-[#1E293B] p-4 rounded-xl border border-white/5 gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={backHref}
            className="p-2 bg-white/10 rounded-lg hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>

          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <FolderOpen className="text-cyanBright shrink-0" />

              <span className="truncate">
                {currentFolderName}
              </span>
            </h1>

            <p className="text-xs text-gray-400">
              Espaço: {selectedSpace.name}
            </p>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Criar pasta */}
        <div className="bg-[#1E293B] p-4 rounded-xl border border-white/5">
          <form
            action={createFolder}
            className="flex gap-2"
          >
            <input
              type="hidden"
              name="parentId"
              value={currentFolderId || ""}
            />

            <input
              type="hidden"
              name="spaceId"
              value={selectedSpace.id}
            />

            <input
              name="name"
              placeholder="Nova Pasta..."
              className="bg-[#0F172A] text-white px-3 py-2 rounded-lg border border-white/10 flex-1 text-xs outline-none"
              required
            />

            <button className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg">
              <FolderPlus className="w-5 h-5" />
            </button>
          </form>
        </div>

        {/* Upload */}
        <UploadForm
          parentId={currentFolderId}
          spaceId={selectedSpace.id}
        />

        {/* Criar link */}
        <div className="bg-[#1E293B] p-4 rounded-xl border border-white/5">
          <form
            action={createLink}
            className="flex gap-2 items-center"
          >
            <input
              type="hidden"
              name="parentId"
              value={currentFolderId || ""}
            />

            <input
              type="hidden"
              name="spaceId"
              value={selectedSpace.id}
            />

            <div className="flex-1 flex flex-col gap-2">
              <input
                name="title"
                placeholder="Nome do Link"
                className="bg-[#0F172A] text-white px-3 py-1.5 rounded-lg border border-white/10 text-xs outline-none"
                required
              />

              <input
                name="url"
                placeholder="https://site.com"
                className="bg-[#0F172A] text-white px-3 py-1.5 rounded-lg border border-white/10 text-xs outline-none"
                required
              />
            </div>

            <button className="bg-green-600 hover:bg-green-500 text-white p-2 rounded-lg h-full">
              <LinkIcon className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      <InteractiveFileList
        materials={sortedMaterials}
        allFolders={allFolders}
        spaceId={selectedSpace.id}
      />
    </div>
  );
}