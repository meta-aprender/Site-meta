import SpaceImageUpload from "./SpaceImageUpload";
import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import {
  LayoutGrid,
  Plus,
  Save,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";

import {
  createSpace,
  updateSpace,
  toggleSpaceStatus,
  moveSpaceOrder,
} from "@/app/actions";

export default async function SpacesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/admin/login");
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      role: true,
    },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/admin/dashboard");
  }

  const spaces = await prisma.space.findMany({
    orderBy: [
      {
        displayOrder: "asc",
      },
      {
        name: "asc",
      },
    ],
  });

  return (
    <div className="space-y-8">
      {/* CABEÇALHO */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <LayoutGrid className="text-cyanBright" />
          Gestão de Espaços
        </h1>

        <p className="text-sm text-gray-400 mt-1">
          Crie, edite e organize os cards exibidos no site.
        </p>
      </div>

      {/* CRIAR NOVO ESPAÇO */}
      <div className="bg-[#1E293B] border border-white/5 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
          <Plus className="w-5 h-5 text-cyanBright" />
          Criar novo espaço
        </h2>

        <form
          action={createSpace}
          className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end"
        >
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Nome do espaço
            </label>

            <input
              name="name"
              placeholder="Ex.: Educação Infantil"
              required
              className="w-full bg-[#0F172A] border border-white/10 p-3 rounded-lg text-white outline-none focus:border-cyanBright"
            />
          </div>

          <button
            type="submit"
            className="bg-vibrantPurple hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Criar
          </button>
        </form>

        <p className="text-xs text-gray-500 mt-3">
          Depois de criar o espaço, você poderá selecionar a imagem diretamente
          na lista abaixo.
        </p>
      </div>

      {/* LISTA DE ESPAÇOS */}
      <div className="space-y-3">
        {spaces.map((space, index) => (
          <div
            key={space.id}
            className={`
              bg-[#1E293B]
              border
              rounded-xl
              p-4

              ${
                space.active
                  ? "border-white/5"
                  : "border-red-500/20 opacity-70"
              }
            `}
          >
            <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center">
              {/* ORDEM */}
              <div className="flex xl:flex-col gap-1">
                <form action={moveSpaceOrder}>
                  <input
                    type="hidden"
                    name="spaceId"
                    value={space.id}
                  />

                  <input
                    type="hidden"
                    name="direction"
                    value="up"
                  />

                  <button
                    type="submit"
                    disabled={index === 0}
                    className="p-2 bg-white/5 rounded-lg hover:bg-cyanBright hover:text-black disabled:opacity-20"
                    title="Mover para cima"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </form>

                <form action={moveSpaceOrder}>
                  <input
                    type="hidden"
                    name="spaceId"
                    value={space.id}
                  />

                  <input
                    type="hidden"
                    name="direction"
                    value="down"
                  />

                  <button
                    type="submit"
                    disabled={index === spaces.length - 1}
                    className="p-2 bg-white/5 rounded-lg hover:bg-cyanBright hover:text-black disabled:opacity-20"
                    title="Mover para baixo"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </form>
              </div>

              {/* UPLOAD DA IMAGEM */}
              <SpaceImageUpload
                spaceId={space.id}
                imageUrl={space.imageUrl}
              />

              {/* EDIÇÃO */}
              <form
                action={updateSpace}
                className="flex-1 w-full grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3"
              >
                <input
                  type="hidden"
                  name="spaceId"
                  value={space.id}
                />

                {/* Mantém a imagem atual ao salvar o nome */}
                <input
                  type="hidden"
                  name="imageUrl"
                  value={space.imageUrl ?? ""}
                />

                <div>
                  <label className="text-[10px] uppercase text-gray-500">
                    Nome
                  </label>

                  <input
                    name="name"
                    defaultValue={space.name}
                    required
                    className="w-full bg-[#0F172A] border border-white/10 px-3 py-2 rounded-lg text-white text-sm outline-none focus:border-cyanBright"
                  />
                </div>

                <button
                  type="submit"
                  className="self-end h-[38px] px-4 bg-white/10 hover:bg-white/20 rounded-lg text-white flex items-center justify-center gap-2 text-sm font-bold"
                >
                  <Save className="w-4 h-4" />
                  Salvar
                </button>
              </form>

              {/* ATIVAR / DESATIVAR */}
              <form action={toggleSpaceStatus}>
                <input
                  type="hidden"
                  name="spaceId"
                  value={space.id}
                />

                <button
                  type="submit"
                  className={`
                    px-4
                    py-2
                    rounded-lg
                    flex
                    items-center
                    gap-2
                    text-sm
                    font-bold

                    ${
                      space.active
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }
                  `}
                >
                  {space.active ? (
                    <>
                      <Eye className="w-4 h-4" />
                      Ativo
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-4 h-4" />
                      Inativo
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-3 text-[10px] text-gray-600">
              Slug: {space.slug}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}