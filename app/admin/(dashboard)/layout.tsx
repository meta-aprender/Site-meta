import { prisma } from "../../lib/prisma";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Sidebar from "./Sidebar";
import AutoLogout from "@/app/components/AutoLogout"; 

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  
  if (!session?.user?.email) {
    redirect("/admin/login");
  }

  // Busca dados para a barra de progresso E a role do usuário
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true } // <-- ADICIONAMOS A 'role' AQUI
  });

  if (!user) return null;

  const aggregation = await prisma.material.aggregate({
    _sum: { size: true },
    where: { userId: user.id },
  });

  const totalUsed = aggregation._sum.size || 0;
  
  // Cálculo de porcentagem visual
  const maxStorage = 10 * 1024 * 1024 * 1024;
  const percentage = Math.min((totalUsed / maxStorage) * 100, 100);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 GB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };

  return (
    <div className="flex h-screen bg-[#0f172a] text-white overflow-hidden">
      <AutoLogout />
      
      {/* Passando a informação de Admin para o Sidebar */}
      <Sidebar 
        usagePercent={percentage} 
        usageText={`${formatBytes(totalUsed)} / 10 GB`} 
        isAdmin={user.role === 'ADMIN'} // <-- ADICIONAMOS A VERIFICAÇÃO AQUI
      />
      
      {/* Área Principal - Ocupa toda a largura disponível */}
      <main className="flex-1 overflow-y-auto w-full relative bg-[#0f172a]">
        <div className="p-4 md:p-6 lg:p-8 pb-20 w-full h-full">
           {children}
        </div>
      </main>
    </div>
  );
}