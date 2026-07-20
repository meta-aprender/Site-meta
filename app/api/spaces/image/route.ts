import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";

import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

import {
  deleteFromWasabi,
  uploadToWasabi,
  WASABI_BUCKET_FILES,
} from "@/app/lib/wasabi";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const session =
    await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new NextResponse(
      "Não autorizado.",
      { status: 401 }
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
      select: {
        role: true,
      },
    });

  if (!user || user.role !== "ADMIN") {
    return new NextResponse(
      "Apenas administradores podem alterar imagens dos espaços.",
      { status: 403 }
    );
  }

  const formData =
    await request.formData();

  const spaceId =
    formData
      .get("spaceId")
      ?.toString();

  const file =
    formData.get("file");

  if (!spaceId) {
    return new NextResponse(
      "Espaço não informado.",
      { status: 400 }
    );
  }

  if (
    !file ||
    !(file instanceof File)
  ) {
    return new NextResponse(
      "Imagem não informada.",
      { status: 400 }
    );
  }

  const extension =
    allowedTypes[file.type];

  if (!extension) {
    return new NextResponse(
      "Formato inválido. Use JPG, PNG ou WebP.",
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return new NextResponse(
      "A imagem deve ter no máximo 5 MB.",
      { status: 400 }
    );
  }

  const space =
    await prisma.space.findUnique({
      where: {
        id: spaceId,
      },
      select: {
        id: true,
        imageUrl: true,
      },
    });

  if (!space) {
    return new NextResponse(
      "Espaço não encontrado.",
      { status: 404 }
    );
  }

  const storagePath =
    `space-images/${spaceId}/${randomUUID()}.${extension}`;

  const buffer =
    Buffer.from(
      await file.arrayBuffer()
    );

  try {
    await uploadToWasabi({
      bucket:
        WASABI_BUCKET_FILES,

      key:
        storagePath,

      body:
        buffer,

      contentType:
        file.type,
    });

    await prisma.space.update({
      where: {
        id: spaceId,
      },

      data: {
        imageUrl:
          storagePath,
      },
    });

    /*
     * Depois que a nova imagem foi salva
     * com sucesso, removemos a antiga.
     */
    if (
      space.imageUrl &&
      space.imageUrl.startsWith(
        "space-images/"
      )
    ) {
      try {
        await deleteFromWasabi(
          WASABI_BUCKET_FILES,
          space.imageUrl
        );
      } catch (error) {
        console.error(
          "Não foi possível excluir a imagem antiga:",
          error
        );
      }
    }

    return NextResponse.json({
      success: true,
      imageUrl:
        storagePath,
    });
  } catch (error) {
    console.error(
      "Erro ao enviar imagem do espaço:",
      error
    );

    return new NextResponse(
      "Não foi possível enviar a imagem.",
      { status: 500 }
    );
  }
}