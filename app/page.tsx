import Showcase from "./components/Showcase";
import { prisma } from "./lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function Home() {
  /*
   * A home agora busca somente os espaços ativos.
   *
   * Não existe mais:
   * - pasta por usuário;
   * - card fixo no código;
   * - ordem baseada em usuário.
   */
  const spaces = await prisma.space.findMany({
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
      slug: true,
      imageUrl: true,
    },
  });

  return (
    <main className="min-h-screen bg-[#F5F5F3] selection:bg-[#10B981]/20">
      <Showcase spaces={spaces} />
    </main>
  );
}