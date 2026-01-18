import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { Collection, sequelize } from "@/lib/models";
import {
  deleteFromSupabaseStorageByUrl,
  uploadToSupabaseStorage,
} from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIA_FOLDER = "collection";

function extensionFromType(type: string) {
  if (type === "image/jpeg") return ".jpg";
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  return "";
}

async function saveImageFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const originalExt = path.extname(file.name || "").toLowerCase();
  const ext = originalExt || extensionFromType(file.type) || ".bin";
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
  const objectPath = `${MEDIA_FOLDER}/${filename}`;

  return uploadToSupabaseStorage(
    objectPath,
    buffer,
    file.type || undefined,
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const { id } = await params;
  const collectionId = Number(id);
  if (!Number.isFinite(collectionId)) {
    return NextResponse.json(
      { error: "Invalid collection id." },
      { status: 400 },
    );
  }

  const collection = await Collection.findByPk(collectionId);
  if (!collection) {
    return NextResponse.json(
      { error: "Collection not found." },
      { status: 404 },
    );
  }

  const formData = await request.formData();
  const title = formData.get("title")?.toString().trim() ?? "";
  const description = formData.get("description")?.toString().trim() ?? "";
  const removeImage = formData.get("remove_image")?.toString() === "1";

  if (!title) {
    return NextResponse.json(
      { error: "Collection name is required." },
      { status: 400 },
    );
  }

  const imageFile = formData.get("image");
  if (imageFile && imageFile instanceof File) {
    if (!imageFile.type?.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed." },
        { status: 400 },
      );
    }
  }

  const previousImageUrl = collection.image_url;
  let shouldDeletePrevious = false;
  try {
    const updated = await sequelize.transaction(async (transaction) => {
      const payload: { title: string; description: string | null; image_url?: string | null } =
        {
          title,
          description: description || null,
        };

      if (imageFile && imageFile instanceof File) {
        payload.image_url = await saveImageFile(imageFile);
        shouldDeletePrevious = Boolean(previousImageUrl);
      } else if (removeImage) {
        payload.image_url = null;
        shouldDeletePrevious = Boolean(previousImageUrl);
      }

      await collection.update(payload, { transaction });
      return collection;
    });

    if (shouldDeletePrevious && previousImageUrl) {
      await deleteFromSupabaseStorageByUrl(previousImageUrl).catch(
        () => undefined,
      );
    }

    return NextResponse.json({ collection: updated.toJSON() }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to update collection." },
      { status: 500 },
    );
  }
}
