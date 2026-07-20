"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MAX_FILE_SIZE = 45 * 1024 * 1024; // 45 MB em bytes

export default function UploadForm({ parentId,  spaceId,}: {parentId: string | null;spaceId: string;}) {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // ESTADOS DE ERRO
  const [fileError, setFileError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // VALIDAÇÃO DE TAMANHO NA SELEÇÃO DOS ARQUIVOS
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      
      // Soma o tamanho de todos os arquivos selecionados
      const totalSize = Array.from(e.target.files).reduce((acc, file) => acc + file.size, 0);

      if (totalSize > MAX_FILE_SIZE) {
        setFileError(`Tamanho excedido! Limite de 45MB. (Total selecionado: ${(totalSize / (1024 * 1024)).toFixed(1)}MB)`);
        setSelectedFiles(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setFileError(null);
        setSelectedFiles(e.target.files);
      }

    } else {
      setSelectedFiles(null);
      setFileError(null);
    }
  };

  // Permite cancelar a seleção antes de enviar
  const clearSelection = () => {
    setSelectedFiles(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Dispara quando clica no botão de Upload
  const handleUpload = () => {
    if (!selectedFiles?.length || fileError) return;
    
    const formData = new FormData();
    Array.from(selectedFiles).forEach(file => formData.append("files", file));
    formData.append("parentId", parentId || "");
    formData.append("spaceId", spaceId);  

    setIsUploading(true);
    setProgress(0);
    setGeneralError(null);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload", true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // SUCESSO
        setIsUploading(false);
        setProgress(0);
        setSelectedFiles(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh(); 
      } else {
        // ERRO DO SERVIDOR
        setIsUploading(false);
        setProgress(0);
        setGeneralError("O servidor recusou o arquivo. Pode ser que o formato não seja permitido ou o servidor esteja cheio.");
      }
    };

    xhr.onerror = () => {
      // ERRO DE REDE/CONEXÃO
      setIsUploading(false);
      setProgress(0);
      setGeneralError("Falha na conexão. Verifique sua internet e tente novamente.");
    };

    xhr.send(formData);
  };

  return (
    <>
      <div className={`p-4 rounded-xl border flex flex-col justify-center gap-3 transition-colors ${fileError ? 'bg-red-500/10 border-red-500/30' : 'bg-[#1E293B] border-white/5'}`}>
        
        {/* Input e Botão de Envio */}
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            multiple 
            onChange={handleFileSelect} 
            disabled={isUploading}
            ref={fileInputRef}
            className={`text-white px-3 py-1.5 rounded-lg border border-white/10 flex-1 text-xs outline-none file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-bold hover:file:bg-purple-600 cursor-pointer disabled:opacity-50 transition-all ${fileError ? 'bg-red-950/50 file:bg-red-600 file:text-white' : 'bg-[#0F172A] file:bg-vibrantPurple file:text-white'}`}
          />
          
          <button 
            onClick={handleUpload}
            disabled={!selectedFiles || isUploading || !!fileError} 
            className={`p-2 rounded-lg transition-all flex items-center justify-center ${
              selectedFiles && !isUploading && !fileError
                ? "bg-cyanBright text-black hover:bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)] cursor-pointer" 
                : "bg-white/10 text-white/50 cursor-not-allowed"
            }`}
          >
            <Upload className="w-5 h-5" />
          </button>
        </div>

        {/* MENSAGEM DE ERRO (Tamanho Excedido) */}
        <AnimatePresence>
          {fileError && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <p className="text-red-400 text-xs font-bold flex items-center gap-1 mt-1">
                <AlertTriangle className="w-4 h-4" /> {fileError}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview do arquivo selecionado */}
        {selectedFiles && !isUploading && !fileError && (
          <div className="flex items-center justify-between bg-[#0F172A] p-2 rounded-lg border border-white/5">
            <div className="flex items-center gap-2 overflow-hidden">
              <FileText className="w-4 h-4 text-cyanBright shrink-0" />
              <span className="text-xs text-gray-300 truncate font-medium">
                {selectedFiles.length === 1 ? selectedFiles[0].name : `${selectedFiles.length} arquivos selecionados`}
              </span>
            </div>
            <button onClick={clearSelection} className="text-gray-400 hover:text-red-400 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {/* Barra de Progresso */}
        {isUploading && (
          <div className="w-full bg-[#0F172A] rounded-full h-6 overflow-hidden border border-white/10 relative shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-vibrantPurple to-cyanBright transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold tracking-widest text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {progress === 100 ? "PROCESSANDO NO SERVIDOR..." : `${progress}% ENVIANDO`}
            </span>
          </div>
        )}
      </div>

      {/* MODAL DE ERRO GERAL (TRATAMENTO DE FALHA NO SERVIDOR) */}
      <AnimatePresence>
        {generalError && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.9, y: 20 }} 
              className="bg-[#1E293B] border border-white/10 w-full max-w-sm rounded-[30px] p-8 text-center shadow-2xl relative"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Ops, deu erro!</h3>
              <p className="text-gray-400 mb-8 text-sm">{generalError}</p>
              
              {/* BOTÃO OK */}
              <button 
                onClick={() => setGeneralError(null)} 
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Ok, entendi
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}