import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseBucket =
  process.env.SUPABASE_STORAGE_BUCKET?.trim() || "product-media";
const supabaseS3Endpoint = process.env.SUPABASE_S3_ENDPOINT?.trim();
const supabaseS3Region = process.env.SUPABASE_S3_REGION?.trim() || "us-east-1";
const supabaseS3AccessKeyId =
  process.env.SUPABASE_S3_ACCESS_KEY_ID?.trim();
const supabaseS3SecretAccessKey =
  process.env.SUPABASE_S3_SECRET_ACCESS_KEY?.trim();

let s3Client: S3Client | null = null;

function getS3Client() {
  if (
    !supabaseS3Endpoint ||
    !supabaseS3AccessKeyId ||
    !supabaseS3SecretAccessKey
  ) {
    throw new Error(
      "Missing SUPABASE_S3_ENDPOINT, SUPABASE_S3_ACCESS_KEY_ID, or SUPABASE_S3_SECRET_ACCESS_KEY environment variable.",
    );
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: supabaseS3Region,
      endpoint: supabaseS3Endpoint,
      credentials: {
        accessKeyId: supabaseS3AccessKeyId,
        secretAccessKey: supabaseS3SecretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  return s3Client;
}

function getPublicUrl(objectPath: string) {
  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL environment variable.");
  }

  return new URL(
    `/storage/v1/object/public/${supabaseBucket}/${objectPath}`,
    supabaseUrl,
  ).toString();
}

export async function uploadToSupabaseStorage(
  objectPath: string,
  buffer: Buffer,
  contentType?: string,
) {
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: supabaseBucket,
      Key: objectPath,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return getPublicUrl(objectPath);
}

function getObjectPathFromPublicUrl(url: string) {
  if (!supabaseUrl) return null;
  const marker = `/storage/v1/object/public/${supabaseBucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const pathWithParams = url.slice(index + marker.length);
  const path = pathWithParams.split(/[?#]/)[0];
  return path || null;
}

export async function deleteFromSupabaseStorageByUrl(url: string) {
  const objectPath = getObjectPathFromPublicUrl(url);
  if (!objectPath) return;

  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: supabaseBucket,
      Key: objectPath,
    }),
  );
}
