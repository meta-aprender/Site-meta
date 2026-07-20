"use client";

import { useState } from "react";
import {
  Pencil,
  X,
  Save,
  Lock,
  User,
  Mail,
  Shield,
} from "lucide-react";
import { updateUser } from "@/app/actions";

interface SpaceProps {
  id: string;
  name: string;
}

interface UserProps {
  id: string;
  name: string;
  email: string;
  role: string;
  spaceIds: string[];
}

export default function EditUserButton({
  user,
  spaces,
}: {
  user: UserProps;
  spaces: SpaceProps[];
}) {
  const [isOpen, setIsOpen] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const handleClose = () =>
    setIsOpen(false);

  const handleSubmit = async (
    formData: FormData
  ) => {
    setIsLoading(true);

    try {
      await updateUser(formData);
      setIsOpen(false);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Erro ao atualizar usuário."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 bg-white/5 hover:bg-yellow-500/20 hover:text-yellow-400 rounded-lg text-gray-400 transition-all border border-white/5"
        title="Editar Usuário"
      >
        <Pencil className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1E293B] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#0F172A] sticky top-0 z-10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-cyanBright" />
                Editar Usuário
              </h3>

              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              action={handleSubmit}
              className="p-6 space-y-5"
            >
              <input
                type="hidden"
                name="userId"
                value={user.id}
              />

              <div className="space-y-1">
                <label className="text-xs text-gray-400">
                  Nome Completo
                </label>

                <div className="flex items-center bg-[#0F172A] border border-white/10 rounded-lg px-3">
                  <User className="w-4 h-4 text-gray-500" />

                  <input
                    name="name"
                    defaultValue={user.name}
                    className="w-full bg-transparent p-3 text-sm text-white outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400">
                  E-mail
                </label>

                <div className="flex items-center bg-[#0F172A] border border-white/10 rounded-lg px-3">
                  <Mail className="w-4 h-4 text-gray-500" />

                  <input
                    name="email"
                    type="email"
                    defaultValue={user.email}
                    className="w-full bg-transparent p-3 text-sm text-white outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400">
                  Função / Permissão
                </label>

                <div className="flex items-center bg-[#0F172A] border border-white/10 rounded-lg px-3">
                  <Shield className="w-4 h-4 text-gray-500" />

                  <select
                    name="role"
                    defaultValue={user.role}
                    className="w-full bg-transparent p-3 text-sm text-white outline-none cursor-pointer"
                  >
                    <option
                      value="USER"
                      className="bg-[#0F172A]"
                    >
                      Servidor Meta
                    </option>

                    <option
                      value="ADMIN"
                      className="bg-[#0F172A]"
                    >
                      Administrador
                    </option>
                  </select>
                </div>
              </div>

              {/* Espaços */}
              <div className="space-y-3 border-t border-white/5 pt-5">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Espaços permitidos
                  </h4>

                  <p className="text-xs text-gray-500">
                    Administradores possuem acesso automático a todos.
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {spaces.map((space) => (
                    <label
                      key={space.id}
                      className="flex items-center gap-2 bg-[#0F172A] border border-white/10 p-3 rounded-lg cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name="spaceIds"
                        value={space.id}
                        defaultChecked={user.spaceIds.includes(
                          space.id
                        )}
                        className="w-4 h-4 accent-cyan-500"
                      />

                      <span className="text-xs text-gray-300">
                        {space.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1 pt-3 border-t border-white/5">
                <label className="text-xs text-yellow-500/80 font-bold">
                  Alterar Senha (Opcional)
                </label>

                <div className="flex items-center bg-[#0F172A] border border-yellow-500/20 rounded-lg px-3">
                  <Lock className="w-4 h-4 text-yellow-500/50" />

                  <input
                    name="password"
                    type="password"
                    minLength={8}
                    placeholder="Deixe vazio para manter a atual"
                    className="w-full bg-transparent p-3 text-sm text-white outline-none placeholder:text-gray-600"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-3 rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 text-sm font-bold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-lg bg-vibrantPurple hover:bg-purple-600 text-white font-bold text-sm flex justify-center items-center gap-2"
                >
                  {isLoading ? (
                    "Salvando..."
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}