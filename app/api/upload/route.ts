import { NextRequest, NextResponse } from "next/server";
import { mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";

import { prisma } from "../../lib/prisma";
import { authOptions } from "../../lib/auth";

export const runtime = "nodejs";

const MAX_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const writtenFilePaths: string[] = [];
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

    const requestedTargetUserId =
      formData.get("targetUserId")?.toString().trim() || null;

    let targetUserId =
      requestedTargetUserId || currentUser.id;

    /*
     * Quando existe uma pasta, o dono do upload deve ser
     * obrigatoriamente o mesmo dono da pasta.
     */
    if (parentId) {
      const parent = await prisma.material.findUnique({
        where: {
          id: parentId,
        },
        select: {
          userId: true,
          type: true,
        },
      });

      if (!parent || parent.type !== "FOLDER") {
        return new NextResponse("Pasta de destino inválida.", {
          status: 400,
        });
      }

      if (
        requestedTargetUserId &&
        requestedTargetUserId !== parent.userId
      ) {
        return new NextResponse(
          "O usuário informado não corresponde ao dono da pasta.",
          { status: 400 }
        );
      }

      targetUserId = parent.userId;
    }

    /*
     * Usuários comuns só podem enviar para a própria conta.
     * Apenas administradores podem enviar para outro usuário.
     */
    if (
      targetUserId !== currentUser.id &&
      currentUser.role !== "ADMIN"
    ) {
      return new NextResponse(
        "Você não possui permissão para modificar esta pasta.",
        { status: 403 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: {
        id: targetUserId,
      },
      select: {
        id: true,
      },
    });

    if (!targetUser) {
      return new NextResponse(
        "Usuário de destino não encontrado.",
        { status: 404 }
      );
    }

    const storageAggregation = await prisma.material.aggregate({
      where: {
        userId: targetUserId,
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

    const uploadDir = join(
      process.cwd(),
      "storage",
      "uploads"
    );

    await mkdir(uploadDir, {
      recursive: true,
    });

    for (const file of files) {
      const rawFileName =
        file.name.split(/[\\/]/).pop() || "arquivo";

      const sanitizedName =
        rawFileName
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .replace(/^\.+/, "") || "arquivo";

      const fileName =
        `${randomUUID()}-${sanitizedName}`;

      const filePath = join(uploadDir, fileName);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      await writeFile(filePath, buffer);
      writtenFilePaths.push(filePath);

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
          fileUrl: `/uploads/${fileName}`,
          size: file.size,
          userId: targetUserId,
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
     * e remove os arquivos que já haviam sido gravados.
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
      writtenFilePaths.map((filePath) =>
        unlink(filePath)
      )
    );

    console.error("Erro no upload:", error);

    return new NextResponse(
      "Erro interno ao realizar o upload.",
      { status: 500 }
    );
  }
}