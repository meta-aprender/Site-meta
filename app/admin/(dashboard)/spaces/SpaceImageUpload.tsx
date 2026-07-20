"use client";

import {
  useRef,
  useState,
} from "react";

import {
  Image as ImageIcon,
  Loader2,
  Upload,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

function getImageSrc(
  imageUrl: string | null
) {
  if (!imageUrl) {
    return null;
  }

  if (
    imageUrl.startsWith(
      "http://"
    ) ||
    imageUrl.startsWith(
      "https://"
    ) ||
    imageUrl.startsWith("/")
  ) {
    return imageUrl;
  }

  return `/api/download?path=${encodeURIComponent(
    imageUrl
  )}&view=true`;
}

export default function SpaceImageUpload({
  spaceId,
  imageUrl,
}: {
  spaceId: string;
  imageUrl: string | null;
}) {
  const router =
    useRouter();

  const inputRef =
    useRef<HTMLInputElement>(
      null
    );

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const imageSrc =
    getImageSrc(imageUrl);

  async function handleFile(
    file: File
  ) {
    setUploading(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "spaceId",
        spaceId
      );

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          "/api/spaces/image",
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        const message =
          await response.text();

        throw new Error(
          message
        );
      }

      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Erro ao enviar imagem."
      );
    } finally {
      setUploading(false);

      if (
        inputRef.current
      ) {
        inputRef.current.value =
          "";
      }
    }
  }

  return (
    <div className="flex items-center gap-3">

      <div
        className="
          w-16
          h-16
          shrink-0
          bg-[#0F172A]
          border
          border-white/10
          rounded-xl
          overflow-hidden
          flex
          items-center
          justify-center
        "
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt="Imagem do espaço"
            className="
              w-full
              h-full
              object-cover
            "
          />
        ) : (
          <ImageIcon
            className="
              w-6
              h-6
              text-gray-600
            "
          />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(
          event
        ) => {
          const file =
            event.target
              .files?.[0];

          if (file) {
            handleFile(file);
          }
        }}
      />

      <button
        type="button"
        disabled={uploading}
        onClick={() =>
          inputRef.current?.click()
        }
        className="
          px-3
          py-2
          rounded-lg
          bg-white/10
          hover:bg-white/20
          text-white
          text-xs
          font-bold
          flex
          items-center
          gap-2
          disabled:opacity-50
        "
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Escolher imagem
          </>
        )}
      </button>

    </div>
  );
}