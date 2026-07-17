import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

type UploadParams = {
  bucket: string;
  key: string;
  body: Buffer;
  contentType?: string;
};

const endpoint = process.env.WASABI_ENDPOINT;
const region = process.env.WASABI_REGION;
const accessKeyId = process.env.WASABI_ACCESS_KEY_ID;
const secretAccessKey = process.env.WASABI_SECRET_ACCESS_KEY;

if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
  throw new Error("Variáveis do Wasabi não configuradas.");
}

export const wasabiClient = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true,
});

export const WASABI_BUCKET_FILES = process.env.WASABI_BUCKET_FILES;
export const WASABI_BUCKET_BACKUPS = process.env.WASABI_BUCKET_BACKUPS;

if (!WASABI_BUCKET_FILES || !WASABI_BUCKET_BACKUPS) {
  throw new Error("Buckets do Wasabi não configurados.");
}

export async function uploadToWasabi({
  bucket,
  key,
  body,
  contentType,
}: UploadParams) {
  await wasabiClient.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getFromWasabi(bucket: string, key: string) {
  const response = await wasabiClient.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  return response;
}

export async function deleteFromWasabi(bucket: string, key: string) {
  await wasabiClient.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

type SignedDownloadParams = {
  bucket: string;
  key: string;
  filename: string;
  contentType?: string;
  inline?: boolean;
};

export async function getSignedDownloadUrl({
  bucket,
  key,
  filename,
  contentType = "application/octet-stream",
  inline = false,
}: SignedDownloadParams) {
  const safeFilename = filename.replace(
    /[\/\\\r\n"]/g,
    "_"
  );

  const disposition = inline
    ? "inline"
    : "attachment";

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,

    ResponseContentDisposition:
      `${disposition}; filename="${safeFilename}"; ` +
      `filename*=UTF-8''${encodeURIComponent(safeFilename)}`,

    ResponseContentType: contentType,
  });

  return getSignedUrl(
    wasabiClient,
    command,
    {
      expiresIn: 600,
    }
  );
}