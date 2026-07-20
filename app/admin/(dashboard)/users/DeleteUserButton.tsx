"use client";

import { Trash2 } from "lucide-react";
import { deleteUser } from "@/app/actions";

export default function DeleteUserButton({ userId }: { userId: string }) {
  return (
    <form 
      action={deleteUser}
      onSubmit={(e) => {
        if (!confirm("Tem certeza que deseja excluir este usuário? Os materiais publicados nos espaços serão preservados.")) {
          e.preventDefault(); // Cancela o envio se o usuário clicar em "Cancelar"
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button 
        className="p-2 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-gray-400 transition-all border border-white/5"
        title="Excluir Usuário e Arquivos"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </form>
  );
}