import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { Op, type Transaction } from "sequelize";

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function saveImageFile(file: File, baseName: string) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const originalExt = path.extname(file.name || "").toLowerCase();
  const ext = originalExt || extensionFromType(file.type) || ".bin";
  const safeBase = slugify(baseName) || "collection";
  const filename = `${safeBase}-1-${Date.now()}-${Math.random().toString(16).slice(2, 6)}${ext}`;
  const objectPath = `${MEDIA_FOLDER}/${filename}`;

  return uploadToSupabaseStorage(
    objectPath,
    buffer,
    file.type || undefined,
  );
}

async function ensureUniqueSlug(
  baseSlug: string,
  collectionId: number,
  transaction?: Transaction,
) {
  let slug = baseSlug;
  let tries = 0;

  while (
    (await Collection.count({
      where: {
        slug,
        id: { [Op.ne]: collectionId },
      },
      transaction,
    })) > 0
  ) {
    tries += 1;
    slug = `${baseSlug}-${Date.now()}-${tries}`;
    if (tries > 5) {
      slug = `${baseSlug}-${Math.random().toString(16).slice(2, 6)}`;
    }
  }

  return slug;
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
  const slugInput = formData.get("slug")?.toString().trim() ?? "";
  const description = formData.get("description")?.toString().trim() ?? "";
  const listingActive = formData.get("listing_active")?.toString() !== "0";
  const removeImage = formData.get("remove_image")?.toString() === "1";

  if (!title) {
    return NextResponse.json(
      { error: "Collection name is required." },
      { status: 400 },
    );
  }
  if (!slugInput) {
    return NextResponse.json(
      { error: "Collection slug is required." },
      { status: 400 },
    );
  }

  const baseSlug = slugify(slugInput);
  if (!baseSlug) {
    return NextResponse.json(
      { error: "Invalid collection slug." },
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
      const payload: {
        title: string;
        description: string | null;
        slug?: string;
        image_url?: string | null;
        listing_active?: boolean;
      } = {
        title,
        description: description || null,
      };

      const uniqueSlug = await ensureUniqueSlug(
        baseSlug,
        collectionId,
        transaction,
      );
      if (uniqueSlug !== collection.slug) {
        payload.slug = uniqueSlug;
      }
      payload.listing_active = listingActive;

      if (imageFile && imageFile instanceof File) {
        payload.image_url = await saveImageFile(imageFile, title);
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
