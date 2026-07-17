import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "../../lib/prisma";
import { authOptions } from "../../lib/auth";
import {
  deleteFromWasabi,
  getFromWasabi,
  getSignedDownloadUrl,
  WASABI_BUCKET_BACKUPS,
  WASABI_BUCKET_FILES,
} from "../../lib/wasabi";

export const runtime = "nodejs";

function getContentType(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "zip":
      return "application/zip";
    case "txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function getFileNameFromPath(path: string) {
  return path.split("/").pop() || "arquivo";
}

function normalizeStoragePath(rawPath: string) {
  const normalizedPath = rawPath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  if (
    !normalizedPath ||
    normalizedPath.includes("\0")
  ) {
    return null;
  }

  const segments = normalizedPath.split("/");

  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".."
    )
  ) {
    return null;
  }

  return normalizedPath;
}

async function bodyToBuffer(body: unknown) {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  const maybeTransformBody = body as {
    transformToByteArray?: () => Promise<Uint8Array>;
  };

  if (typeof maybeTransformBody.transformToByteArray === "function") {
    const bytes = await maybeTransformBody.transformToByteArray();
    return Buffer.from(bytes);
  }

  const chunks: Buffer[] = [];

  for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk)
    );
  }

  return Buffer.concat(chunks);
}

async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      role: true,
    },
  });
}

export async function GET(req: NextRequest) {
  const rawPath =
    req.nextUrl.searchParams.get("path");

  const wantsCleanup =
    req.nextUrl.searchParams.get("cleanup") ===
    "true";

  const wantsView =
    req.nextUrl.searchParams.get("view") ===
    "true";

  if (!rawPath) {
    return new NextResponse(
      "Caminho não informado.",
      { status: 400 }
    );
  }

  const storagePath =
    normalizeStoragePath(rawPath);

  if (!storagePath) {
    return new NextResponse(
      "Caminho inválido.",
      { status: 400 }
    );
  }

  const segments = storagePath.split("/");
  const storageCategory = segments[0];

  let downloadName = getFileNameFromPath(storagePath);
  let cleanupAllowed = false;
  let isPublicFile = false;
  let bucket = WASABI_BUCKET_FILES;

  const pathCandidates = [
    storagePath,
    `/${storagePath}`,
  ];

  /*
   * Materiais enviados pelos usuários:
   * somente o proprietário ou um administrador.
   */
  if (storageCategory === "uploads") {
    if (segments.length < 2) {
      return new NextResponse(
        "Caminho de material inválido.",
        { status: 400 }
      );
    }

    const currentUser =
      await getAuthenticatedUser();

    if (!currentUser) {
      return new NextResponse(
        "Não autorizado.",
        { status: 401 }
      );
    }

    const material =
      await prisma.material.findFirst({
        where: {
          fileUrl: {
            in: pathCandidates,
          },
        },
        select: {
          title: true,
          userId: true,
        },
      });

    if (!material) {
      return new NextResponse(
        "Arquivo não encontrado.",
        { status: 404 }
      );
    }

    if (
      material.userId !== currentUser.id &&
      currentUser.role !== "ADMIN"
    ) {
      return new NextResponse(
        "Você não possui permissão para acessar este arquivo.",
        { status: 403 }
      );
    }

    downloadName = material.title;
  }

  /*
   * Capas de livros:
   * podem ser exibidas no catálogo público,
   * mas precisam existir no banco.
   */
  else if (storageCategory === "covers") {
    if (segments.length !== 2) {
      return new NextResponse(
        "Caminho de capa inválido.",
        { status: 400 }
      );
    }

    const book = await prisma.book.findFirst({
      where: {
        OR: [
          { coverUrl: storagePath },
          { coverUrl: `/${storagePath}` },
        ],
      },
      select: {
        id: true,
      },
    });

    if (!book) {
      return new NextResponse(
        "Capa não encontrada.",
        { status: 404 }
      );
    }

    isPublicFile = true;
  }

  /*
   * Arquivos de livros:
   * são públicos quando estiverem cadastrados.
   */
  else if (storageCategory === "books") {
  if (segments.length !== 2) {
    return new NextResponse(
      "Caminho de livro inválido.",
      { status: 400 }
    );
  }

  const book = await prisma.book.findFirst({
    where: {
      OR: [
        { contentUrl: storagePath },
        { contentUrl: `/${storagePath}` },
      ],
    },
    select: {
      title: true,
    },
  });

  if (!book) {
    return new NextResponse(
      "Livro não encontrado.",
      { status: 404 }
    );
  }

  const originalExtension =
    storagePath.split(".").pop();

  downloadName = book.title;

  if (
    originalExtension &&
    !downloadName
      .toLowerCase()
      .endsWith(`.${originalExtension.toLowerCase()}`)
  ) {
    downloadName =
      `${downloadName}.${originalExtension}`;
  }

  isPublicFile = true;
}

  /*
   * Backups:
   * somente o proprietário ou um administrador.
   * Apenas backups podem usar cleanup=true.
   */
  else if (storageCategory === "backups") {
    if (
      segments.length !== 3 ||
      !segments[2].toLowerCase().endsWith(".zip")
    ) {
      return new NextResponse(
        "Caminho de backup inválido.",
        { status: 400 }
      );
    }

    const currentUser =
      await getAuthenticatedUser();

    if (!currentUser) {
      return new NextResponse(
        "Não autorizado.",
        { status: 401 }
      );
    }

    const backupOwnerId = segments[1];

    if (
      currentUser.id !== backupOwnerId &&
      currentUser.role !== "ADMIN"
    ) {
      return new NextResponse(
        "Você não possui permissão para acessar este backup.",
        { status: 403 }
      );
    }

    bucket = WASABI_BUCKET_BACKUPS;
    cleanupAllowed = true;
  } else {
    return new NextResponse(
      "Tipo de arquivo não permitido.",
      { status: 403 }
    );
  }

  if (wantsCleanup && !cleanupAllowed) {
    return new NextResponse(
      "A exclusão automática não é permitida para este arquivo.",
      { status: 403 }
    );
  }
  if (storageCategory === "books") {
  try {
    const signedUrl =
      await getSignedDownloadUrl({
        bucket,
        key: storagePath,
        filename: downloadName,
        contentType:
          getContentType(storagePath),
        inline: wantsView,
      });

    return NextResponse.redirect(
      signedUrl
    );
  } catch (error) {
    console.error(
      "Erro ao gerar link do livro:",
      error
    );

    return new NextResponse(
      "Não foi possível gerar o download do livro.",
      { status: 500 }
    );
  }
}

  try {
    const file = await getFromWasabi(bucket, storagePath);
    const buffer = await bodyToBuffer(file.Body);

    if (wantsCleanup) {
      try {
        await deleteFromWasabi(bucket, storagePath);
      } catch (cleanupError) {
        console.error(
          "Erro ao excluir backup temporário:",
          cleanupError
        );
      }
    }

    const safeFilename = downloadName.replace(
      /[\/\\\r\n"]/g,
      "_"
    );

    const dispositionType =
      storageCategory === "backups"
        ? "attachment"
        : wantsView
          ? "inline"
          : "attachment";

    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition":
          `${dispositionType}; filename="${safeFilename}"; ` +
          `filename*=UTF-8''${encodeURIComponent(safeFilename)}`,

        "Content-Type":
          getContentType(downloadName),

        "Content-Length":
          buffer.length.toString(),

        "Cache-Control": isPublicFile
          ? "public, max-age=3600"
          : "private, no-store",
      },
    });
  } catch (error) {
    console.error(
      "Erro ao realizar download:",
      error
    );

    return new NextResponse(
      "Arquivo não encontrado no storage.",
      { status: 404 }
    );
  }
}