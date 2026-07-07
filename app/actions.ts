"use server";

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
  const session = await getServerSession();
  const user = await prisma.user.findUnique({ where: { email: session?.user?.email! } });
  
  const name = formData.get("name") as string;
  const rawParentId = formData.get("parentId") as string;
  const parentId = (rawParentId === "" || rawParentId === "root") ? null : rawParentId;

  // Lógica de Dono
  let targetUserId = user!.id;
  if (parentId) {
      const parent = await prisma.material.findUnique({ where: { id: parentId } });
      if (parent) targetUserId = parent.userId;
  } else {
      const formTargetId = formData.get("targetUserId") as string;
      if (formTargetId) targetUserId = formTargetId;
  }

  if (user!.id !== targetUserId && user!.role !== 'ADMIN') throw new Error("Sem permissão.");

  await prisma.material.create({
    data: { title: name, type: "FOLDER", size: 0, userId: targetUserId, parentId: parentId }
  });
  revalidatePath("/admin/dashboard");
}

// --- 3. CRIAR LINK CORRIGIDO (COM HERANÇA DE DONO) ---
export async function createLink(formData: FormData) {
    const session = await getServerSession();
    const user = await prisma.user.findUnique({ where: { email: session?.user?.email! } });

    const title = formData.get("title") as string;
    const url = formData.get("url") as string;
    const rawParentId = formData.get("parentId") as string;
    const parentId = (rawParentId === "" || rawParentId === "root") ? null : rawParentId;

    // Lógica de Dono
    let targetUserId = user!.id;
    if (parentId) {
        const parent = await prisma.material.findUnique({ where: { id: parentId } });
        if (parent) targetUserId = parent.userId;
    } else {
        const formTargetId = formData.get("targetUserId") as string;
        if (formTargetId) targetUserId = formTargetId;
    }

    if (user!.id !== targetUserId && user!.role !== 'ADMIN') throw new Error("Sem permissão.");

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
    const session = await getServerSession();
    const itemId = formData.get("itemId") as string;
    const newName = formData.get("newName") as string;

    await checkPermission(itemId, session?.user?.email!);

    await prisma.material.update({
        where: { id: itemId },
        data: { title: newName }
    });
    revalidatePath("/admin/dashboard");
}

// --- 5. EXCLUIR USUÁRIO ---
export async function deleteUser(formData: FormData) {
    const session = await getServerSession();
    const currentUser = await prisma.user.findUnique({ where: { email: session?.user?.email! } });
    
    if (currentUser?.role !== 'ADMIN') throw new Error("Apenas Admin pode excluir usuários.");

    const userIdToDelete = formData.get("userId") as string;
    if (userIdToDelete === currentUser!.id) throw new Error("Você não pode excluir a si mesmo.");

    const userMaterials = await prisma.material.findMany({ where: { userId: userIdToDelete } });
    for (const item of userMaterials) {
        await deleteMaterial(item.id); 
    }

    await prisma.user.delete({ where: { id: userIdToDelete } });
    revalidatePath("/admin/users");
}

// --- 6. MOVER ---
export async function moveMaterial(formData: FormData) {
  const session = await getServerSession();
  const itemId = formData.get("itemId") as string;
  const newParentId = formData.get("newParentId") as string;
  const finalParentId = (newParentId === "root" || newParentId === "") ? null : newParentId;

  await checkPermission(itemId, session?.user?.email!);

  if (itemId === finalParentId) throw new Error("Destino inválido.");

  if (finalParentId) {
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
  const session = await getServerSession();
  try {
     await checkPermission(id, session?.user?.email!);
  } catch { return; }

  const item = await prisma.material.findUnique({ where: { id } });
  if (!item) return;

  if (item.type === 'FOLDER') {
    const children = await prisma.material.findMany({ where: { parentId: id } });
    for (const child of children) {
      await deleteMaterial(child.id);
    }
  } else if (item.fileUrl && item.type !== 'LINK') {
      try { await unlink(join(process.cwd(), "public", item.fileUrl)); } catch {}
  }

  await prisma.material.delete({ where: { id } });
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
  const session = await getServerSession();
  const currentUser = await prisma.user.findUnique({ where: { email: session?.user?.email! } });
  
  if (currentUser?.role !== 'ADMIN') throw new Error("Apenas Admin pode criar usuários.");

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;
  const passwordHash = await hash(password, 6);
  
  await prisma.user.create({
    data: { name, email, password: passwordHash, role, folderName: `Pasta de ${name}` }
  });
  revalidatePath("/admin/users");
}

export async function updateProfile(formData: FormData) {
  const session = await getServerSession();
  await prisma.user.update({
    where: { email: session!.user!.email! },
    data: {
      folderName: formData.get("folderName") as string,
      folderCategory: formData.get("folderCategory") as string,
      folderDescription: formData.get("folderDescription") as string,
    },
  });
  revalidatePath("/");
  revalidatePath("/admin/settings");
}

export async function getFolderContents(folderId: string) {
   return await prisma.material.findMany({ 
     where: { parentId: folderId }, 
     orderBy: { type: 'asc' } 
   });
}

// --- ATUALIZAR USUÁRIO (ADMIN) ---
export async function updateUser(formData: FormData) {
  const session = await getServerSession();
  const currentUser = await prisma.user.findUnique({ where: { email: session?.user?.email! } });

  if (currentUser?.role !== 'ADMIN') {
    throw new Error("Permissão negada. Apenas administradores podem editar usuários.");
  }

  const userIdToUpdate = formData.get("userId") as string;
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as string;
  const password = formData.get("password") as string;

  // Prepara os dados para atualização
  const updateData: any = {
    name,
    email,
    role
  };

  // Só atualiza a senha se o campo não estiver vazio
  if (password && password.trim() !== "") {
    updateData.password = await hash(password, 6);
  }

  await prisma.user.update({
    where: { id: userIdToUpdate },
    data: updateData
  });

  revalidatePath("/admin/users");
}

export async function moveUserOrder(formData: FormData) {
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
  const session = await getServerSession();
  const user = await prisma.user.findUnique({ where: { email: session?.user?.email! } });
  if (user?.role !== 'ADMIN') throw new Error("Sem permissão.");

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
  const title = formData.get("title") as string;
  const category = formData.get("category") as string;
  const subCategory = formData.get("subCategory") as string;
  const type = formData.get("type") as string; 
  const userId = formData.get("userId") as string;
  
  const coverFile = formData.get("cover") as File;
  const contentFile = formData.get("contentFile") as File;
  const contentLink = formData.get("contentLink") as string;

  try {
    // 1. CORREÇÃO: Salvar a Capa na pasta 'storage/covers' e padronizar nome
    const coverName = `${Date.now()}-capa.jpg`; 
    const coverDir = join(process.cwd(), "storage", "covers");
    await mkdir(coverDir, { recursive: true });
    const coverBuffer = Buffer.from(await coverFile.arrayBuffer());
    await writeFile(join(coverDir, coverName), coverBuffer);
    
    // Caminho relativo para a nossa API buscar depois
    const coverUrl = `covers/${coverName}`;

    // 2. Processar o Conteúdo
    let finalContentUrl = "";
    if (type === 'FILE' && contentFile) {
      const fileName = `${Date.now()}-${contentFile.name.replace(/\s/g, "_")}`;
      const storageDir = join(process.cwd(), "storage", "books");
      await mkdir(storageDir, { recursive: true });
      const fileBuffer = Buffer.from(await contentFile.arrayBuffer());
      await writeFile(join(storageDir, fileName), fileBuffer);
      finalContentUrl = `books/${fileName}`; 
    } else {
      finalContentUrl = contentLink;
    }

    // 3. Salvar no Banco
    await prisma.book.create({
      data: {
        title, category, subCategory: subCategory || null, type,
        coverUrl, contentUrl: finalContentUrl, userId
      }
    });

    revalidatePath("/");
    revalidatePath("/admin/dashboard/books");
    return { success: true };
  } catch (error) {
    console.error("Erro ao cadastrar livro:", error);
    return { error: "Falha ao processar o cadastro." };
  }
}

// --- 11. EDITAR LIVRO (APENAS TEXTOS E LINKS) ---
export async function updateBook(formData: FormData) {
  const session = await getServerSession();
  const user = await prisma.user.findUnique({ where: { email: session?.user?.email! } });
  if (user?.role !== 'ADMIN') throw new Error("Sem permissão.");

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