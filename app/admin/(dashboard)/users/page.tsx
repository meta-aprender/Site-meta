import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  UserPlus,
  Shield,
  User,
} from "lucide-react";

import { createNewUser } from "@/app/actions";
import EditUserButton from "./EditUserButton";
import DeleteUserButton from "./DeleteUserButton";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/admin/login");
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400">
        <Shield className="w-16 h-16 mb-4 text-red-500" />

        <h1 className="text-xl font-bold text-white">
          Acesso Negado
        </h1>

        <p>
          Apenas administradores podem gerenciar usuários.
        </p>
      </div>
    );
  }

  const [users, spaces] = await Promise.all([
    prisma.user.findMany({
      orderBy: {
        createdAt: "asc",
      },

      include: {
        spaceAccesses: {
          select: {
            spaceId: true,
          },
        },
      },
    }),

    prisma.space.findMany({
      where: {
        active: true,
      },

      orderBy: [
        {
          displayOrder: "asc",
        },
        {
          name: "asc",
        },
      ],

      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8 w-full">

      {/* CABEÇALHO */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Gestão de Usuários
        </h1>

        <p className="text-gray-400 text-sm mt-1">
          Cadastre usuários e defina quais espaços cada pessoa poderá gerenciar.
        </p>
      </div>

      {/* NOVO USUÁRIO */}
      <div className="bg-[#1E293B] border border-white/5 p-6 rounded-2xl shadow-xl">

        <h2 className="text-lg text-white mb-6 flex items-center gap-2 font-bold">
          <UserPlus className="text-cyanBright" />

          Novo Cadastro
        </h2>

        <form
          action={createNewUser}
          className="space-y-6"
        >

          {/* DADOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

            {/* NOME */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                Nome
              </label>

              <input
                name="name"
                placeholder="Nome completo"
                className="w-full bg-[#0F172A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-cyanBright"
                required
              />
            </div>

            {/* EMAIL */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                E-mail
              </label>

              <input
                name="email"
                type="email"
                placeholder="email@exemplo.com"
                className="w-full bg-[#0F172A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-cyanBright"
                required
              />
            </div>

            {/* SENHA */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                Senha
              </label>

              <input
                name="password"
                type="password"
                minLength={8}
                placeholder="Mínimo de 8 caracteres"
                className="w-full bg-[#0F172A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-cyanBright"
                required
              />
            </div>

            {/* PERFIL */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                Perfil
              </label>

              <select
                name="role"
                defaultValue="USER"
                className="w-full bg-[#0F172A] border border-white/10 p-3 rounded-lg text-white text-sm outline-none focus:border-cyanBright"
              >
                <option value="USER">
                  Servidor Meta
                </option>

                <option value="ADMIN">
                  Administrador
                </option>
              </select>
            </div>
          </div>

          {/* ESPAÇOS */}
          <div className="border-t border-white/5 pt-5">

            <div className="mb-4">
              <h3 className="text-sm font-bold text-white">
                Espaços que este usuário poderá gerenciar
              </h3>

              <p className="text-xs text-gray-500 mt-1">
                Administradores possuem acesso automático a todos os espaços.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">

              {spaces.map((space) => (
                <label
                  key={space.id}
                  className="
                    flex
                    items-center
                    gap-3
                    bg-[#0F172A]
                    border
                    border-white/10
                    p-3
                    rounded-lg
                    cursor-pointer
                    hover:border-cyanBright/40
                    transition-colors
                  "
                >
                  <input
                    type="checkbox"
                    name="spaceIds"
                    value={space.id}
                    className="w-4 h-4 accent-cyan-500"
                  />

                  <span className="text-sm text-gray-300">
                    {space.name}
                  </span>
                </label>
              ))}

            </div>
          </div>

          {/* BOTÃO CADASTRAR */}
          <div className="flex justify-end">

            <button
              type="submit"
              className="
                bg-vibrantPurple
                text-white
                px-6
                py-3
                rounded-lg
                font-bold
                hover:bg-purple-600
                transition-all
                flex
                justify-center
                items-center
                gap-2
              "
            >
              <UserPlus className="w-4 h-4" />

              Cadastrar Usuário
            </button>

          </div>

        </form>
      </div>

      {/* LISTA DE USUÁRIOS */}
      <div className="bg-[#0F172A] rounded-2xl overflow-hidden border border-white/10">

        <div className="overflow-x-auto">

          <table className="w-full text-left text-gray-400 min-w-[900px]">

            <thead className="bg-[#1E293B] text-white text-xs uppercase tracking-wider">

              <tr>
                <th className="p-4">
                  Usuário
                </th>

                <th className="p-4">
                  E-mail
                </th>

                <th className="p-4">
                  Função
                </th>

                <th className="p-4">
                  Espaços
                </th>

                <th className="p-4 text-right">
                  Ações
                </th>
              </tr>

            </thead>

            <tbody className="divide-y divide-white/5">

              {users.map((user) => {

                const userSpaceIds =
                  user.spaceAccesses.map(
                    (access) => access.spaceId
                  );

                const userSpaceNames =
                  spaces
                    .filter((space) =>
                      userSpaceIds.includes(space.id)
                    )
                    .map((space) => space.name);

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-white/5 transition-colors"
                  >

                    {/* USUÁRIO */}
                    <td className="p-4">

                      <div className="flex items-center gap-3">

                        <div
                          className={`
                            w-8
                            h-8
                            rounded-full
                            flex
                            items-center
                            justify-center

                            ${
                              user.role === "ADMIN"
                                ? "bg-vibrantPurple/20 text-vibrantPurple"
                                : "bg-cyanBright/20 text-cyanBright"
                            }
                          `}
                        >
                          <User className="w-4 h-4" />
                        </div>

                        <span className="font-medium text-white">
                          {user.name}
                        </span>

                      </div>

                    </td>

                    {/* EMAIL */}
                    <td className="p-4 text-sm">
                      {user.email}
                    </td>

                    {/* FUNÇÃO */}
                    <td className="p-4">

                      {user.role === "ADMIN" ? (
                        <span className="
                          bg-purple-500/10
                          text-purple-400
                          px-2
                          py-1
                          rounded
                          text-xs
                          font-bold
                          border
                          border-purple-500/20
                          inline-flex
                          items-center
                          gap-1
                        ">
                          <Shield className="w-3 h-3" />

                          ADMIN
                        </span>
                      ) : (
                        <span className="
                          bg-blue-500/10
                          text-blue-400
                          px-2
                          py-1
                          rounded
                          text-xs
                          font-bold
                          border
                          border-blue-500/20
                        ">
                          SERVIDOR META
                        </span>
                      )}

                    </td>

                    {/* ESPAÇOS */}
                    <td className="p-4">

                      {user.role === "ADMIN" ? (

                        <span className="text-xs text-purple-400">
                          Todos os espaços
                        </span>

                      ) : userSpaceNames.length > 0 ? (

                        <div className="flex flex-wrap gap-1.5">

                          {userSpaceNames.map((name) => (
                            <span
                              key={name}
                              className="
                                bg-cyan-500/10
                                text-cyan-300
                                border
                                border-cyan-500/20
                                px-2
                                py-1
                                rounded-md
                                text-xs
                              "
                            >
                              {name}
                            </span>
                          ))}

                        </div>

                      ) : (

                        <span className="text-xs text-gray-600">
                          Nenhum espaço
                        </span>

                      )}

                    </td>

                    {/* AÇÕES */}
                    <td className="p-4">

                      <div className="flex justify-end gap-2">

                        <EditUserButton
                          user={{
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            role: user.role,
                            spaceIds: userSpaceIds,
                          }}
                          spaces={spaces}
                        />

                        {user.id !== currentUser.id && (
                          <DeleteUserButton
                            userId={user.id}
                          />
                        )}

                      </div>

                    </td>

                  </tr>
                );
              })}

            </tbody>

          </table>

        </div>
      </div>

    </div>
  );
}