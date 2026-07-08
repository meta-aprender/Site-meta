"use server";

import {
  deleteFromWasabi,
  uploadToWasabi,
  WASABI_BUCKET_FILES,
} from "./lib/wasabi";
import { prisma } from "./lib/prisma";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join, resolve, sep } from "path";
import { getServerSession } from "next-auth";
import { hash } from "bcryptjs";
import AdmZip from "adm-zip";
import { randomUUID } from "crypto";
import { authOptions } from "./lib/auth";

// --- HELPERS ---
async function requireAdmin() {
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
      role: true,
    },
  });

  if (!user || user.role !== "ADMIN") {
    throw new Error("Sem permissão.");
  }

  return user;
}



// Verifica permissão: Retorna o item se o usuário pode mexer nele
async function checkPermission(itemId: string, userEmail: string) {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) throw new Error("Usuário não encontrado");

  const item = await prisma.material.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Item não encontrado");

  // Se for Admin, pode tudo. Se for o dono, pode. Senão, erro.
  if (user.role === 'ADMIN' || item.userId === user.id) {
    return { item, user };
  }
  
  throw new Error("Permissão negada.");
}
async function requireAuthenticatedUser() {
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

async function getAllFilesRecursively(folderId: string): Promise<{path: string, dbPath: string}[]> {
  const files: {path: string, dbPath: string}[] = [];
  const items = await prisma.material.findMany({ where: { parentId: folderId } });

  for (const item of items) {
    if (item.type === 'FOLDER') {
      const subFiles = await getAllFilesRecursively(item.id);
      files.push(...subFiles.map(f => ({ path: join(item.title, f.path), dbPath: f.dbPath })));
    } else if (item.fileUrl && item.type !== 'LINK') {
      files.push({ path: item.title, dbPath: item.fileUrl });
    }
  }
  return files;
}

// --- 1. UPLOAD MÚLTIPLO CORRIGIDO (COM HERANÇA DE DONO) ---
export async function uploadFiles(formData: FormData) {
  const session = await getServerSession();
  if (!session?.user?.email) throw new Error("Login necessário");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("Usuário não encontrado");

  const files = formData.getAll("files") as File[];
  const rawParentId = formData.get("parentId") as string;
  const parentId = (rawParentId === "" || rawParentId === "root") ? null : rawParentId;
  
  let targetUserId = user.id;

  if (parentId) {
     const parent = await prisma.material.findUnique({ where: { id: parentId } });
     if (parent) targetUserId = parent.userId;
  } else {
     const formTargetId = formData.get("targetUserId") as string;
     if (formTargetId) targetUserId = formTargetId;
  }

  if (user.id !== targetUserId && user.role !== 'ADMIN') {
      throw new Error("Sem permissão para modificar esta pasta.");
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, include: { materials: true } });
  
  // VERIFICAÇÃO DA COTA DE USUÁRIO (10GB)
  const MAX_STORAGE = 10 * 1024 * 1024 * 1024; 
  const currentUsage = targetUser!.materials.reduce((acc, item) => acc + item.size, 0);
  const totalUploadSize = files.reduce((acc, file) => acc + file.size, 0);

  if (currentUsage + totalUploadSize > MAX_STORAGE) {
    throw new Error("Cota de 10 GB excedida para este usuário.");
  }

  for (const file of files) {
    if (file.size === 0) continue;
    
    // AQUI NÃO TEM MAIS NENHUMA TRAVA DE LIMITE INDIVIDUAL!
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const uploadDir = join(process.cwd(), "storage", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, fileName), buffer);

    await prisma.material.create({
      data: {
        title: file.name,
        type: file.name.split(".").pop()?.toUpperCase() || "FILE",
        fileUrl: `/uploads/${fileName}`,
        size: file.size,
        userId: targetUserId,
        parentId: parentId,
      },
    });
  }
  revalidatePath("/admin/dashboard");
}

// --- 2. CRIAR PASTA CORRIGIDO (COM HERANÇA DE DONO) ---
export async function createFolder(formData: FormData) {
  const user = await requireAuthenticatedUser();
  
  const name = formData.get("name") as string;
  const rawParentId = formData.get("parentId") as string;
  const parentId = (rawParentId === "" || rawParentId === "root") ? null : rawParentId;

  // Lógica de Dono
  let targetUserId = user.id;
  if (parentId) {
      const parent = await prisma.material.findUnique({ where: { id: parentId } });
      if (parent) targetUserId = parent.userId;
  } else {
      const formTargetId = formData.get("targetUserId") as string;
      if (formTargetId) targetUserId = formTargetId;
  }

  if (user.id !== targetUserId && user.role !== 'ADMIN') throw new Error("Sem permissão.");

  await prisma.material.create({
    data: { title: name, type: "FOLDER", size: 0, userId: targetUserId, parentId: parentId }
  });
  revalidatePath("/admin/dashboard");
}

// --- 3. CRIAR LINK CORRIGIDO (COM HERANÇA DE DONO) ---
export async function createLink(formData: FormData) {
    const user = await requireAuthenticatedUser();

    const title = formData.get("title") as string;
    const url = formData.get("url") as string;
    const rawParentId = formData.get("parentId") as string;
    const parentId = (rawParentId === "" || rawParentId === "root") ? null : rawParentId;

    // Lógica de Dono
    let targetUserId = user.id;
    if (parentId) {
        const parent = await prisma.material.findUnique({ where: { id: parentId } });
        if (parent) targetUserId = parent.userId;
    } else {
        const formTargetId = formData.get("targetUserId") as string;
        if (formTargetId) targetUserId = formTargetId;
    }

    if (user.id !== targetUserId && user.role !== 'ADMIN') throw new Error("Sem permissão.");

    await prisma.material.create({
        data: {
            title: title || "Novo Link",
            type: "LINK",
            fileUrl: url.startsWith("http") ? url : `https://${url}`,
            size: 0,
            userId: targetUserId,
            parentId: parentId,
        }
    });
    revalidatePath("/admin/dashboard");
}

// --- 4. RENOMEAR (ESTAVA FALTANDO) ---
export async function renameMaterial(formData: FormData) {
    const user = await requireAuthenticatedUser();
    const itemId = formData.get("itemId") as string;
    const newName = formData.get("newName") as string;

    await checkPermission(itemId, user.email);

    await prisma.material.update({
        where: { id: itemId },
        data: { title: newName }
    });
    revalidatePath("/admin/dashboard");
}

// --- 5. EXCLUIR USUÁRIO ---
export async function deleteUser(formData: FormData) {
  const currentUser = await requireAdmin();

  const userIdToDelete = formData.get("userId") as string;

  if (!userIdToDelete) {
    throw new Error("Usuário não informado.");
  }

  if (userIdToDelete === currentUser.id) {
    throw new Error("Você não pode excluir a própria conta.");
  }

  const userToDelete = await prisma.user.findUnique({
    where: { id: userIdToDelete },
  });

  if (!userToDelete) {
    throw new Error("Usuário não encontrado.");
  }

  const userMaterials = await prisma.material.findMany({
    where: { userId: userIdToDelete },
  });

  for (const item of userMaterials) {
    await deleteMaterial(item.id);
  }

  await prisma.user.delete({
    where: { id: userIdToDelete },
  });

  revalidatePath("/");
  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
}
// --- 6. MOVER ---
export async function moveMaterial(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const itemId = formData.get("itemId") as string;
  const newParentId = formData.get("newParentId") as string;
  const finalParentId = (newParentId === "root" || newParentId === "") ? null : newParentId;

  const { item } = await checkPermission(itemId, user.email);

  if (itemId === finalParentId) throw new Error("Destino inválido.");

  if (finalParentId) {
    const destination = await prisma.material.findUnique({
      where: { id: finalParentId },
    });

    if (!destination || destination.type !== "FOLDER") {
      throw new Error("Pasta de destino inválida.");
    }

    if (destination.userId !== item.userId) {
      throw new Error(
        "Não é permitido mover materiais entre usuários diferentes."
      );
    }
      let currentCheckId = finalParentId;
      while (currentCheckId) {
        if (currentCheckId === itemId) throw new Error("Não pode mover para subpasta própria.");
        const parent = await prisma.material.findUnique({ where: { id: currentCheckId } });
        if (!parent || !parent.parentId) break;
        currentCheckId = parent.parentId;
      }
    }

  await prisma.material.update({
    where: { id: itemId },
    data: { parentId: finalParentId }
  });
  revalidatePath("/admin/dashboard");
}

// --- 7. DELETAR RECURSIVO ---
export async function deleteMaterial(id: string) {
  const user = await requireAuthenticatedUser();

  try {
    await checkPermission(id, user.email);
  } catch {
    return;
  }

  const item = await prisma.material.findUnique({
    where: { id },
  });

  if (!item) return;

  if (item.type === "FOLDER") {
    const children = await prisma.material.findMany({
      where: { parentId: id },
    });

    for (const child of children) {
      await deleteMaterial(child.id);
    }
    } else if (item.fileUrl && item.type !== "LINK") {
    const objectKey = item.fileUrl
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");

    const segments = objectKey.split("/");

    if (
      !objectKey ||
      objectKey.includes("\0") ||
      segments.some(
        (segment) =>
          !segment ||
          segment === "." ||
          segment === ".."
      )
    ) {
      throw new Error("Caminho de arquivo inválido.");
    }

    await deleteFromWasabi(
      WASABI_BUCKET_FILES,
      objectKey
    );
  }

  await prisma.material.delete({
    where: { id },
  });

  revalidatePath("/admin/dashboard");
}

// --- 8. BACKUP (ZIP) ---
export async function downloadBackup() {
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
    },
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  const zip = new AdmZip();

  const allMaterials = await prisma.material.findMany({
    where: {
      userId: user.id,
    },
  });

  const sanitizeZipSegment = (value: string) => {
    return (
      value
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .replace(/\.\./g, "_")
        .trim() || "sem-nome"
    );
  };

  const getZipPath = (
    item: (typeof allMaterials)[number],
    allItems: typeof allMaterials
  ): string => {
    if (!item.parentId) {
      return "";
    }

    const parent = allItems.find(
      (candidate) => candidate.id === item.parentId
    );

    if (!parent) {
      return "";
    }

    return (
      getZipPath(parent, allItems) +
      sanitizeZipSegment(parent.title) +
      "/"
    );
  };

  const storageRoot = resolve(
    process.cwd(),
    "storage"
  );

  for (const item of allMaterials) {
    if (
      item.type !== "FOLDER" &&
      item.type !== "LINK" &&
      item.fileUrl
    ) {
      try {
        const relativeFilePath = item.fileUrl.replace(
          /^[/\\]+/,
          ""
        );

        const filePath = resolve(
          storageRoot,
          relativeFilePath
        );

        if (
          !filePath.startsWith(
            `${storageRoot}${sep}`
          )
        ) {
          throw new Error(
            "Caminho de arquivo inválido."
          );
        }

        const folderPathInsideZip = getZipPath(
          item,
          allMaterials
        );

        zip.addLocalFile(
          filePath,
          folderPathInsideZip
        );
      } catch (error) {
        console.error(
          "Arquivo não incluído no backup:",
          item.title,
          error
        );
      }
    } else if (item.type === "FOLDER") {
      const folderPathInsideZip =
        getZipPath(item, allMaterials) +
        sanitizeZipSegment(item.title) +
        "/";

      zip.addFile(
        folderPathInsideZip,
        Buffer.alloc(0)
      );
    }
  }

  const backupName =
    `${Date.now()}-${randomUUID()}.zip`;

  const backupDirectory = join(
    process.cwd(),
    "storage",
    "backups",
    user.id
  );

  await mkdir(backupDirectory, {
    recursive: true,
  });

  await zip.writeZipPromise(
    join(backupDirectory, backupName)
  );

  return `/backups/${user.id}/${backupName}`;
}

// --- AÇÕES ADMIN / OUTROS ---
export async function createNewUser(formData: FormData) {
  await requireAdmin();

  const name =
    formData.get("name")?.toString().trim() || "";

  const email =
    formData.get("email")?.toString().trim().toLowerCase() || "";

  const password =
    formData.get("password")?.toString() || "";

  const requestedRole =
    formData.get("role")?.toString();

  const role =
    requestedRole === "ADMIN" ? "ADMIN" : "USER";

  if (!name || !email || !password) {
    throw new Error(
      "Nome, e-mail e senha são obrigatórios."
    );
  }

  if (password.length < 8) {
    throw new Error(
      "A senha deve ter pelo menos 8 caracteres."
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    throw new Error(
      "Já existe um usuário com este e-mail."
    );
  }

  const passwordHash = await hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      role,
      folderName: `Pasta de ${name}`,
    },
  });

  revalidatePath("/admin/users");
}

export async function updateProfile(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Login necessário.");
  }

  const folderName =
    formData.get("folderName")?.toString().trim() ||
    "Minha Pasta";

  const folderCategory =
    formData.get("folderCategory")?.toString().trim() ||
    "Geral";

  const folderDescription =
    formData
      .get("folderDescription")
      ?.toString()
      .trim() || null;

  await prisma.user.update({
    where: {
      email: session.user.email,
    },
    data: {
      folderName,
      folderCategory,
      folderDescription,
    },
  });

  revalidatePath("/");
  revalidatePath("/admin/settings");
}

export async function getFolderContents(
  folderId: string
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Login necessário.");
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!currentUser) {
    throw new Error("Usuário não encontrado.");
  }

  const folder = await prisma.material.findUnique({
    where: {
      id: folderId,
    },
    select: {
      userId: true,
      type: true,
    },
  });

  if (!folder || folder.type !== "FOLDER") {
    throw new Error("Pasta não encontrada.");
  }

  if (
    folder.userId !== currentUser.id &&
    currentUser.role !== "ADMIN"
  ) {
    throw new Error(
      "Você não possui permissão para acessar esta pasta."
    );
  }

  return prisma.material.findMany({
    where: {
      parentId: folderId,
    },
    orderBy: {
      type: "asc",
    },
  });
}

// --- ATUALIZAR USUÁRIO (ADMIN) ---
export async function updateUser(
  formData: FormData
) {
  await requireAdmin();

  const userIdToUpdate =
    formData.get("userId")?.toString() || "";

  const name =
    formData.get("name")?.toString().trim() || "";

  const email =
    formData.get("email")?.toString().trim().toLowerCase() || "";

  const requestedRole =
    formData.get("role")?.toString();

  const role =
    requestedRole === "ADMIN" ? "ADMIN" : "USER";

  const password =
    formData.get("password")?.toString() || "";

  if (!userIdToUpdate || !name || !email) {
    throw new Error(
      "Usuário, nome e e-mail são obrigatórios."
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: {
      id: userIdToUpdate,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!targetUser) {
    throw new Error("Usuário não encontrado.");
  }

  const conflictingUser =
    await prisma.user.findFirst({
      where: {
        email,
        id: {
          not: userIdToUpdate,
        },
      },
    });

  if (conflictingUser) {
    throw new Error(
      "Já existe outro usuário com este e-mail."
    );
  }

  if (
    targetUser.role === "ADMIN" &&
    role !== "ADMIN"
  ) {
    const adminCount = await prisma.user.count({
      where: {
        role: "ADMIN",
      },
    });

    if (adminCount <= 1) {
      throw new Error(
        "Não é possível remover o único administrador."
      );
    }
  }

  const updateData: {
    name: string;
    email: string;
    role: string;
    password?: string;
  } = {
    name,
    email,
    role,
  };

  if (password.trim()) {
    if (password.length < 8) {
      throw new Error(
        "A nova senha deve ter pelo menos 8 caracteres."
      );
    }

    updateData.password = await hash(password, 10);
  }

  await prisma.user.update({
    where: {
      id: userIdToUpdate,
    },
    data: updateData,
  });

  revalidatePath("/admin/users");
}

export async function moveUserOrder(formData: FormData) {
  await requireAdmin();
  const userId = formData.get("userId") as string;
  const direction = formData.get("direction") as "up" | "down";

  // Busca todos os usuários ordenados pela ordem atual (e desempata por data de criação)
  const users = await prisma.user.findMany({
      orderBy: [
          { displayOrder: 'asc' },
          { createdAt: 'asc' } 
      ]
  });

  const currentIndex = users.findIndex(u => u.id === userId);
  if (currentIndex === -1) return;

  // Bloqueia se tentar subir o primeiro ou descer o último
  if ((direction === 'up' && currentIndex === 0) || (direction === 'down' && currentIndex === users.length - 1)) {
      return;
  }

  // Descobre com quem ele vai trocar de lugar
  const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  
  // Troca eles de posição no array
  const temp = users[currentIndex];
  users[currentIndex] = users[swapIndex];
  users[swapIndex] = temp;

  // Atualiza TODO MUNDO no banco de dados com a nova numeração (0, 1, 2, 3...) oculta
  // Usa transação para ser super rápido
  const updates = users.map((user, index) => 
      prisma.user.update({
          where: { id: user.id },
          data: { displayOrder: index }
      })
  );
  await prisma.$transaction(updates);

  revalidatePath("/");
  revalidatePath("/admin/users");
}

// --- CRIAR PASTA OU LINK ---
export async function createMaterial(formData: FormData) {
  const session = await getServerSession();
  if (!session?.user?.email) throw new Error("Login necessário");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("Usuário não encontrado");

  const title = formData.get("title") as string;
  const type = formData.get("type") as string; // 'FOLDER' ou 'LINK'
  const fileUrl = formData.get("fileUrl") as string | null;
  
  const rawParentId = formData.get("parentId") as string;
  const parentId = (rawParentId === "" || rawParentId === "root") ? null : rawParentId;
  
  let targetUserId = user.id;

  if (parentId) {
     const parent = await prisma.material.findUnique({ where: { id: parentId } });
     if (parent) targetUserId = parent.userId;
  } else {
     const formTargetId = formData.get("targetUserId") as string;
     if (formTargetId) targetUserId = formTargetId;
  }

  if (user.id !== targetUserId && user.role !== 'ADMIN') {
      throw new Error("Sem permissão para modificar esta pasta.");
  }

  await prisma.material.create({
    data: {
      title,
      type: type === 'LINK' ? 'LINK' : 'FOLDER',
      fileUrl: type === 'LINK' ? fileUrl : null,
      userId: targetUserId,
      parentId: parentId,
    }
  });

  revalidatePath("/admin/dashboard");
}

// --- 10. EXCLUIR LIVRO DO CATÁLOGO ---
export async function deleteBook(formData: FormData) {
  await requireAdmin();

  const bookId = formData.get("bookId") as string;
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) return;

  // CORREÇÃO: Agora apagamos a capa da pasta STORAGE, não mais da public
  if (book.coverUrl) {
    const coverPath = join(process.cwd(), "storage", book.coverUrl.replace(/^\//, ''));
    try { await unlink(coverPath); } catch (e) { console.log("Capa não encontrada no disco"); }
  }
  
  if (book.type === 'FILE' && book.contentUrl) {
    const contentPath = join(process.cwd(), "storage", book.contentUrl.replace(/^\//, ''));
    try { await unlink(contentPath); } catch (e) { console.log("PDF não encontrado no disco"); }
  }

  await prisma.book.delete({ where: { id: bookId } });
  revalidatePath("/");
  revalidatePath("/admin/dashboard/books");
}


export async function createBook(formData: FormData) {
  const admin = await requireAdmin();

  const title =
    formData.get("title")?.toString().trim() || "";

  const category =
    formData.get("category")?.toString().trim() || "";

  const subCategory =
    formData.get("subCategory")?.toString().trim() || "";

  const type =
    formData.get("type")?.toString().trim() || "";

  const contentLink =
    formData.get("contentLink")?.toString().trim() || "";

  const coverFile = formData.get("cover");
  const contentFile = formData.get("contentFile");

  if (!title || !category) {
    return {
      error: "Informe o título e a categoria.",
    };
  }

  if (type !== "FILE" && type !== "LINK") {
    return {
      error: "Formato de livro inválido.",
    };
  }

  if (
    !(coverFile instanceof File) ||
    coverFile.size === 0
  ) {
    return {
      error: "Selecione uma capa.",
    };
  }

  const allowedCoverTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

  if (!allowedCoverTypes.has(coverFile.type)) {
    return {
      error: "A capa deve ser JPG, PNG ou WEBP.",
    };
  }

  const MAX_COVER_SIZE =
    5 * 1024 * 1024;

  if (coverFile.size > MAX_COVER_SIZE) {
    return {
      error: "A capa deve ter no máximo 5 MB.",
    };
  }

  if (type === "FILE") {
    if (
      !(contentFile instanceof File) ||
      contentFile.size === 0
    ) {
      return {
        error: "Selecione o arquivo PDF.",
      };
    }

    const isPdf =
      contentFile.type === "application/pdf" ||
      contentFile.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return {
        error: "O arquivo do livro deve ser PDF.",
      };
    }

    const MAX_PDF_SIZE =
      40 * 1024 * 1024;

    if (contentFile.size > MAX_PDF_SIZE) {
      return {
        error: "O PDF deve ter no máximo 40 MB.",
      };
    }
  }

  if (type === "LINK") {
    try {
      const parsedUrl = new URL(contentLink);

      if (
        parsedUrl.protocol !== "https:" &&
        parsedUrl.protocol !== "http:"
      ) {
        throw new Error();
      }
    } catch {
      return {
        error: "Informe um link válido.",
      };
    }
  }

  const uploadedObjectKeys: string[] = [];

  try {
    const coverExtension =
      coverFile.type === "image/png"
        ? "png"
        : coverFile.type === "image/webp"
          ? "webp"
          : "jpg";

    const coverName =
      `${randomUUID()}.${coverExtension}`;

    const coverBuffer = Buffer.from(
      await coverFile.arrayBuffer()
    );

    const coverUrl =
      `covers/${coverName}`;

    await uploadToWasabi({
      bucket: WASABI_BUCKET_FILES,
      key: coverUrl,
      body: coverBuffer,
      contentType: coverFile.type,
    });

    uploadedObjectKeys.push(coverUrl);

    let finalContentUrl = contentLink;

    if (
      type === "FILE" &&
      contentFile instanceof File
    ) {
      const bookFileName =
        `${randomUUID()}.pdf`;

      const fileBuffer = Buffer.from(
        await contentFile.arrayBuffer()
      );

      finalContentUrl =
        `books/${bookFileName}`;

      await uploadToWasabi({
        bucket: WASABI_BUCKET_FILES,
        key: finalContentUrl,
        body: fileBuffer,
        contentType: "application/pdf",
      });

      uploadedObjectKeys.push(finalContentUrl);
    }
    await prisma.book.create({
      data: {
        title,
        category,
        subCategory: subCategory || null,
        type,
        coverUrl,
        contentUrl: finalContentUrl,
        userId: admin.id,
      },
    });

    revalidatePath("/");
    revalidatePath("/admin/dashboard/books");

    return {
      success: true,
    };
  } catch (error) {
    await Promise.allSettled(
      uploadedObjectKeys.map((objectKey) =>
        deleteFromWasabi(
          WASABI_BUCKET_FILES,
          objectKey
        )
      )
    );

    console.error(
      "Erro ao cadastrar livro:",
      error
    );

    return {
      error: "Falha ao processar o cadastro.",
    };
  }
}

// --- 11. EDITAR LIVRO (APENAS TEXTOS E LINKS) ---
  export async function updateBook(formData: FormData) {
  await requireAdmin();

  const id = formData.get("bookId") as string;
  const title = formData.get("title") as string;
  const category = formData.get("category") as string;
  const subCategory = formData.get("subCategory") as string;
  const contentLink = formData.get("contentLink") as string;

  // Atualiza apenas os dados textuais para segurança. Se precisar trocar o PDF, é melhor excluir e recriar.
  await prisma.book.update({
    where: { id },
    data: { 
      title, 
      category, 
      subCategory: subCategory || null,
      ...(contentLink ? { contentUrl: contentLink } : {}) 
    }
  });

  revalidatePath("/");
  revalidatePath("/admin/dashboard/books");
}