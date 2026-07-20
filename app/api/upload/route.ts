import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { canManageSpace } from "../../lib/space-permissions";

import { prisma } from "../../lib/prisma";
import { authOptions } from "../../lib/auth";
import {
  deleteFromWasabi,
  uploadToWasabi,
  WASABI_BUCKET_FILES,
} from "../../lib/wasabi";

export const runtime = "nodejs";

const MAX_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const uploadedObjectKeys: string[] = [];
  const createdMaterialIds: string[] = [];

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return new NextResponse("Não autorizado.", { status: 401 });
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
      return new NextResponse("Usuário não encontrado.", { status: 404 });
    }

    const formData = await req.formData();

    const files = formData
      .getAll("files")
      .filter(
        (item): item is File =>
          item instanceof File && item.size > 0
      );

    if (files.length === 0) {
      return new NextResponse("Nenhum arquivo válido enviado.", {
        status: 400,
      });
    }

    const rawParentId = formData.get("parentId")?.toString().trim();
    const parentId =
      !rawParentId || rawParentId === "root"
        ? null
        : rawParentId;

    const requestedSpaceId =
  formData.get("spaceId")?.toString().trim() || null;

if (!requestedSpaceId) {
  return new NextResponse("Espaço não informado.", {
    status: 400,
  });
}

let spaceId = requestedSpaceId;

/*
 * Se o upload estiver sendo feito dentro de uma pasta,
 * o espaço obrigatoriamente deve ser o mesmo da pasta.
 */
if (parentId) {
  const parent = await prisma.material.findUnique({
    where: {
      id: parentId,
    },
    select: {
      spaceId: true,
      type: true,
    },
  });

  if (!parent || parent.type !== "FOLDER") {
    return new NextResponse("Pasta de destino inválida.", {
      status: 400,
    });
  }

  if (!parent.spaceId) {
    return new NextResponse(
      "Esta pasta pertence à estrutura antiga.",
      { status: 400 }
    );
  }

  if (parent.spaceId !== requestedSpaceId) {
    return new NextResponse(
      "A pasta não pertence ao espaço informado.",
      { status: 400 }
    );
  }

  spaceId = parent.spaceId;
}

const space = await prisma.space.findUnique({
  where: {
    id: spaceId,
  },
  select: {
    id: true,
    active: true,
  },
});

if (!space || !space.active) {
  return new NextResponse("Espaço não encontrado.", {
    status: 404,
  });
}

const hasAccess = await canManageSpace(
  currentUser,
  spaceId
);

if (!hasAccess) {
  return new NextResponse(
    "Você não possui permissão para gerenciar este espaço.",
    { status: 403 }
  );
}

    const storageAggregation = await prisma.material.aggregate({
      where: {
        userId: spaceId,
      },
      _sum: {
        size: true,
      },
    });

    const currentUsage =
      storageAggregation._sum.size || 0;

    const totalUploadSize = files.reduce(
      (total, file) => total + file.size,
      0
    );

    if (
      currentUsage + totalUploadSize >
      MAX_STORAGE_BYTES
    ) {
      return new NextResponse(
        "Cota de 10 GB excedida para este usuário.",
        { status: 413 }
      );
    }

    for (const file of files) {
      const rawFileName =
        file.name.split(/[\\/]/).pop() || "arquivo";

      const sanitizedName =
        rawFileName
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .replace(/^\.+/, "") || "arquivo";

      const fileName =
        `${randomUUID()}-${sanitizedName}`;

      const objectKey =
        `spaces/${spaceId}/${fileName}`;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      await uploadToWasabi({
        bucket: WASABI_BUCKET_FILES,
        key: objectKey,
        body: buffer,
        contentType: file.type || "application/octet-stream",
      });

      uploadedObjectKeys.push(objectKey);

      const extension =
        sanitizedName.includes(".")
          ? sanitizedName
              .split(".")
              .pop()
              ?.toUpperCase() || "FILE"
          : "FILE";

      const material = await prisma.material.create({
        data: {
          title: file.name,
          type: extension,
          fileUrl: `/${objectKey}`,
          size: file.size,
          userId: currentUser.id,
          spaceId,
          parentId,
        },
        select: {
          id: true,
        },
      });

      createdMaterialIds.push(material.id);
    }

    return NextResponse.json({
      success: true,
      uploadedFiles: createdMaterialIds.length,
    });
  } catch (error) {
    /*
     * Se algum arquivo do lote falhar, desfaz os registros
     * e remove os arquivos que já haviam sido enviados ao Wasabi.
     */
    if (createdMaterialIds.length > 0) {
      await prisma.material
        .deleteMany({
          where: {
            id: {
              in: createdMaterialIds,
            },
          },
        })
        .catch((cleanupError) => {
          console.error(
            "Erro ao limpar registros do upload:",
            cleanupError
          );
        });
    }

    await Promise.allSettled(
      uploadedObjectKeys.map((objectKey) =>
        deleteFromWasabi(WASABI_BUCKET_FILES, objectKey)
      )
    );

    console.error("Erro no upload:", error);

    return new NextResponse(
      "Erro interno ao realizar o upload.",
      { status: 500 }
    );
  }
}