"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutGrid, LayoutDashboard, Users, LogOut, Settings, Menu, X, BookOpen } from "lucide-react";

export default function Sidebar({ 
  usagePercent, 
  usageText, 
  isAdmin // <-- NOVA PROPRIEDADE PARA CONTROLE DE ACESSO
}: { 
  usagePercent: number; 
  usageText: string; 
  isAdmin: boolean; 
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Mapeamento do menu com controle de exibição (show)
  const menuItems = [
    { name: "Visão Geral", icon: LayoutDashboard, href: "/admin/dashboard", show: true },
    { name: "Usuários", icon: Users, href: "/admin/users", show: isAdmin },
    { name: "Catálogo de Livros", icon: BookOpen, href: "/admin/books", show: isAdmin }, // <-- NOVA ABA
    { name: "Configurações", icon: Settings, href: "/admin/settings", show: true },
    {  name: "Espaços",  icon: LayoutGrid,  href: "/admin/spaces",  show: isAdmin,},
  ].filter(item => item.show); // Remove os itens que o usuário não pode ver

  return (
    <>
      {/* --- BOTÃO MOBILE --- */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-vibrantPurple rounded-lg text-white shadow-lg"
      >
        {isOpen ? <X /> : <Menu />}
      </button>

      {/* --- OVERLAY ESCURO --- */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* --- SIDEBAR --- */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-[#0A192F] border-r border-white/10 z-40 flex flex-col transition-transform duration-300
        ${isOpen ? "translate-x-0" : "-translate-x-full"} 
        md:translate-x-0 md:static md:h-screen
      `}>
        
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-heading font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyanBright to-vibrantPurple">
            META ADMIN
          </h2>
        </div>

        {/* Links */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href) && (item.href !== "/admin/dashboard" || pathname === "/admin/dashboard");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-vibrantPurple text-white shadow-lg shadow-vibrantPurple/20"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Barra de Progresso */}
        <div className="px-6 py-4 bg-[#051020] border-t border-white/5">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Armazenamento</span>
            <span>{usageText}</span>
          </div>
          <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${usagePercent > 90 ? 'bg-red-500' : 'bg-cyanBright'}`}
              style={{ width: `${usagePercent}%` }} 
            />
          </div>
        </div>

        {/* Botão Sair */}
        <div className="p-4">
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}