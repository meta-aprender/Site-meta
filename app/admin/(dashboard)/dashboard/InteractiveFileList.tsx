"use client";

import { useState } from "react";
import Link from "next/link";
import { Folder, Link as LinkIcon, Trash2, Download } from "lucide-react";
import FileIcon from "@/app/components/FileIcon";
import MoveButton from "./MoveButton";
import RenameButton from "./RenameButton"; 
import { deleteMaterial } from "@/app/actions"; 
import FilePreviewModal from "./FilePreviewModal"; // Importa o Modal que você criou no Passo 1

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function InteractiveFileList({
  materials,
  allFolders,
  spaceId,
}: any) {
  // Estado que controla qual arquivo está selecionado para o preview
  const [selectedFile, setSelectedFile] = useState<any>(null);

  if (materials.length === 0) {
    return (
      <div className="col-span-full py-10 text-center text-gray-500 border border-dashed border-gray-700 rounded-xl">
          Pasta vazia.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {materials.map((item: any) => (
          <div key={item.id} className="group bg-[#0F172A] border border-white/10 p-3 rounded-xl flex items-center justify-between hover:border-cyanBright/30 transition-all">
              
              <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                  <div className="shrink-0">
                      {item.type === 'FOLDER' ? <Folder className="w-8 h-8 text-yellow-500" /> : 
                       item.type === 'LINK' ? <LinkIcon className="w-8 h-8 text-green-400" /> :
                       <FileIcon filename={item.title} className="w-8 h-8" />}
                  </div>
                  <div className="truncate pr-2 w-full">
                      {item.type === 'FOLDER' ? (
                          <Link 
                              href={`/admin/dashboard?space=${spaceId}&folder=${item.id}`} 
                              className="text-white font-bold hover:underline block truncate text-sm"
                          >
                              {item.title}
                          </Link>
                      ) : item.type === 'LINK' ? (
                          <a 
                              href={item.fileUrl!} 
                              target="_blank" 
                              className="text-white font-medium hover:underline block truncate text-sm"
                          >
                              {item.title}
                          </a>
                      ) : (
                          // AQUI RESOLVEMOS O ERRO 404 E ADICIONAMOS O PREVIEW!
                          // Em vez de um link 'href', vira um botão que abre o Modal de Preview
                          <button 
                              onClick={() => setSelectedFile(item)} 
                              className="text-white font-medium hover:text-cyanBright hover:underline block truncate text-sm text-left w-full cursor-pointer"
                          >
                              {item.title}
                          </button>
                      )}
                      
                      <span className="text-[10px] text-gray-500 block">
                          {item.type === 'FOLDER' ? 'Pasta' : item.type === 'LINK' ? 'Link Externo' : formatBytes(item.size)}
                      </span>
                  </div>
              </div>

              <div className="flex items-center gap-1">
                  {/* Botão de Download Rápido Exclusivo para Arquivos */}
                  {item.type !== 'FOLDER' && item.type !== 'LINK' && (
                    <a 
                      href={`/api/download?path=${item.fileUrl}`} 
                      target="_blank"
                      className="text-cyanBright hover:text-white bg-[#1E293B] p-2 rounded-lg border border-white/5 hover:bg-cyanBright/20 transition-colors"
                      title="Baixar Arquivo"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}

                  <MoveButton 
                      itemId={item.id} 
                      folders={allFolders.filter((f: any) => f.id !== item.id)} 
                  />
                  <RenameButton itemId={item.id} currentName={item.title} />
                  <form action={deleteMaterial.bind(null, item.id)}>
                      <button className="text-red-400 hover:text-red-500 bg-[#1E293B] p-2 rounded-lg border border-white/5 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                      </button>
                  </form>
              </div>

          </div>
        ))}
      </div>

      {/* Renderiza o Modal se algum arquivo for clicado */}
      <FilePreviewModal 
        file={selectedFile} 
        onClose={() => setSelectedFile(null)} 
      />
    </>
  );
}