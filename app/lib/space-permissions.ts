import { getServerSession } from "next-auth";

import { authOptions } from "./auth";
import { prisma } from "./prisma";

type AuthenticatedUser = {
  id: string;
  email: string;
  role: string;
};

export async function requireCurrentUser(): Promise<AuthenticatedUser> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Login necessário.");
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  return user;
}

export async function canManageSpace(
  user: AuthenticatedUser,
  spaceId: string
): Promise<boolean> {
  // Administrador pode gerenciar qualquer espaço.
  if (user.role === "ADMIN") {
    return true;
  }

  const access = await prisma.userSpace.findUnique({
    where: {
      userId_spaceId: {
        userId: user.id,
        spaceId,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(access);
}

export async function requireSpaceAccess(spaceId: string) {
  const user = await requireCurrentUser();

  const hasAccess = await canManageSpace(user, spaceId);

  if (!hasAccess) {
    throw new Error("Você não possui permissão para gerenciar este espaço.");
  }

  return user;
}