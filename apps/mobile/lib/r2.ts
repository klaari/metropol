import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.EXPO_PUBLIC_R2_ENDPOINT!;
const accessKeyId = process.env.EXPO_PUBLIC_R2_ACCESS_KEY!;
const secretAccessKey = process.env.EXPO_PUBLIC_R2_SECRET_KEY!;
const bucket = process.env.EXPO_PUBLIC_R2_BUCKET!;

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

/** Presigned PUT URL for uploading a file to R2. Expires in 10 minutes. */
export async function getUploadUrl(
  fileKey: string,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: fileKey,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: 600 });
}

/** Presigned GET URL for downloading/streaming a file from R2. Expires in 1 hour. */
export async function getDownloadUrl(fileKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: fileKey,
  });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}

/** Delete an object from R2. */
export async function deleteObject(fileKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: fileKey,
  });
  await client.send(command);
}

/** Build the R2 object key for a track: tracks/{contentHash}.{ext} */
export function buildContentKey(contentHash: string, ext: string): string {
  return `tracks/${contentHash}.${ext}`;
}
