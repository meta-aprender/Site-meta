"use client";

import { useState } from "react";
import { Archive, Loader2 } from "lucide-react";
import { downloadBackup } from "@/app/actions";

export default function BackupButton() {
  const [loading, setLoading] = useState(false);

  const handleBackup = async () => {
    setLoading(true);
    try {
      // 1. Pede para o servidor gerar o ZIP (retorna o caminho: /backups/arquivo.zip)
      const urlPath = await downloadBackup();
      
      // 2.2. Usa a API segura para baixar o backup
      // window.location.href força o download direto sem abrir aba em branco
      window.location.href = `/api/download?path=${urlPath}`;
      
    } catch (error) {
      alert("Erro ao criar backup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleBackup}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 bg-green-600/10 text-green-400 hover:bg-green-600/20 border border-green-600/20 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
      {loading ? "Gerando e Baixando..." : "Baixar Backup ZIP"}
    </button>
  );
}