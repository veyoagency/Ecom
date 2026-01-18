import { randomBytes } from "crypto";
import path from "path";

import { NextRequest, NextResponse } from "next/server";
import type { Transaction } from "sequelize";

import { requireAdmin } from "@/lib/admin";
import {
  Collection,
  Product,
  ProductCollection,
  ProductImage,
  ProductOption,
  ProductOptionValue,
  sequelize,
} from "@/lib/models";
import { uploadToSupabaseStorage } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIA_FOLDER = "product";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function extensionFromType(type: string) {
  if (type === "image/jpeg") return ".jpg";
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  if (type === "video/mp4") return ".mp4";
  if (type === "video/webm") return ".webm";
  if (type === "video/quicktime") return ".mov";
  return "";
}

async function ensureUniqueSlug(baseSlug: string, transaction?: Transaction) {
  let slug = baseSlug;
  let tries = 0;

  while (
    (await Product.count({
      where: { slug },
      transaction,
    })) > 0
  ) {
    tries += 1;
    slug = `${baseSlug}-${randomBytes(2).toString("hex")}`;
    if (tries > 8) {
      slug = `${baseSlug}-${Date.now()}`;
    }
  }

  return slug;
}

async function saveMediaFile(file: File, baseName: string, position: number) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const originalExt = path.extname(file.name || "").toLowerCase();
  const ext = originalExt || extensionFromType(file.type) || ".bin";
  const safeBase = slugify(baseName) || "product";
  const filename = `${safeBase}-${position + 1}-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
  const objectPath = `${MEDIA_FOLDER}/${filename}`;

  return uploadToSupabaseStorage(
    objectPath,
    buffer,
    file.type || undefined,
  );
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const formData = await request.formData();
  const title = formData.get("title")?.toString().trim() ?? "";
  const description = formData.get("description")?.toString().trim() ?? "";
  const priceRaw = formData.get("price")?.toString().trim() ?? "";
  const compareAtRaw = formData.get("compare_at")?.toString().trim() ?? "";
  const status = formData.get("status")?.toString() ?? "active";
  const inStock = formData.get("in_stock")?.toString() !== "0";
  const variantsRaw = formData.get("variants")?.toString() ?? "";
  const mediaOrderRaw = formData.get("media_order")?.toString() ?? "";

  if (!title || !description || !priceRaw) {
    return NextResponse.json(
      { error: "Title, description, and price are required." },
      { status: 400 },
    );
  }

  const priceNumber = Number(priceRaw.replace(",", "."));
  if (!Number.isFinite(priceNumber)) {
    return NextResponse.json({ error: "Invalid price." }, { status: 400 });
  }

  const priceCents = Math.round(priceNumber * 100);
  let compareAtCents: number | null = null;
  if (compareAtRaw) {
    const compareAtNumber = Number(compareAtRaw.replace(",", "."));
    if (!Number.isFinite(compareAtNumber)) {
      return NextResponse.json(
        { error: "Invalid compare at price." },
        { status: 400 },
      );
    }
    compareAtCents = Math.round(compareAtNumber * 100);
  }
  const active = status === "active";

  const collectionIds = formData
    .getAll("collections")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  let variantOptions: Array<{ name: string; values: string[] }> = [];
  if (variantsRaw) {
    try {
      const parsed = JSON.parse(variantsRaw);
      if (!Array.isArray(parsed)) {
        throw new Error("Invalid variants payload.");
      }
      variantOptions = parsed
        .map((option: { name?: string; values?: string[] }) => ({
          name: option?.name?.toString().trim() ?? "",
          values: Array.isArray(option?.values)
            ? option.values
                .map((value) => value?.toString().trim() ?? "")
                .filter(Boolean)
            : [],
        }))
        .filter((option) => option.name && option.values.length > 0);
    } catch {
      return NextResponse.json(
        { error: "Invalid variants payload." },
        { status: 400 },
      );
    }
  }

  let mediaOrder: string[] = [];
  if (mediaOrderRaw) {
    try {
      const parsed = JSON.parse(mediaOrderRaw);
      if (!Array.isArray(parsed)) {
        throw new Error("Invalid media order.");
      }
      mediaOrder = parsed.map((entry) => entry?.toString().trim() ?? "");
    } catch {
      return NextResponse.json(
        { error: "Invalid media order." },
        { status: 400 },
      );
    }
  }

  const mediaEntries = formData
    .getAll("media")
    .filter((value): value is File => value instanceof File);

  for (const file of mediaEntries) {
    if (
      !(file.type?.startsWith("image/") || file.type?.startsWith("video/"))
    ) {
      return NextResponse.json(
        { error: "Only image and video files are allowed." },
        { status: 400 },
      );
    }
  }

  if (mediaOrder.length > 0) {
    const invalidOrder = mediaOrder.some((entry) => {
      if (entry.startsWith("existing:")) return true;
      if (!entry.startsWith("new:")) return true;
      const index = Number(entry.slice(4));
      return !Number.isInteger(index) || index < 0 || index >= mediaEntries.length;
    });
    if (invalidOrder) {
      return NextResponse.json(
        { error: "Invalid media order." },
        { status: 400 },
      );
    }
  }

  const baseSlug = slugify(title);
  if (!baseSlug) {
    return NextResponse.json({ error: "Invalid title." }, { status: 400 });
  }

  try {
    const product = await sequelize.transaction(async (transaction) => {
      const slug = await ensureUniqueSlug(baseSlug, transaction);
      const created = await Product.create(
        {
          title,
          slug,
          description_html: description,
          price_cents: priceCents,
          compare_at_cents: compareAtCents,
          active,
          in_stock: inStock,
        },
        { transaction },
      );

      if (collectionIds.length > 0) {
        const existingCollections = await Collection.count({
          where: { id: collectionIds },
          transaction,
        });

        if (existingCollections !== collectionIds.length) {
          throw new Error("Invalid collection selection.");
        }

        await ProductCollection.bulkCreate(
          collectionIds.map((collectionId) => ({
            product_id: created.id,
            collection_id: collectionId,
          })),
          { transaction },
        );
      }

      const mediaRecords = [];
      if (mediaOrder.length > 0) {
        for (const entry of mediaOrder) {
          if (!entry.startsWith("new:")) continue;
          const index = Number(entry.slice(4));
          const file = mediaEntries[index];
          if (!file) {
            throw new Error("Invalid media order.");
          }
          const url = await saveMediaFile(file, created.slug, mediaRecords.length);
          mediaRecords.push({
            product_id: created.id,
            url,
            position: mediaRecords.length,
          });
        }
      } else {
        for (const [index, file] of mediaEntries.entries()) {
          const url = await saveMediaFile(file, created.slug, index);
          mediaRecords.push({
            product_id: created.id,
            url,
            position: index,
          });
        }
      }

      if (mediaRecords.length > 0) {
        await ProductImage.bulkCreate(mediaRecords, { transaction });
      }

      if (variantOptions.length > 0) {
        for (const [optionIndex, option] of variantOptions.entries()) {
          const createdOption = await ProductOption.create(
            {
              product_id: created.id,
              name: option.name,
              position: optionIndex,
            },
            { transaction },
          );

          await ProductOptionValue.bulkCreate(
            option.values.map((value, valueIndex) => ({
              option_id: createdOption.id,
              value,
              position: valueIndex,
            })),
            { transaction },
          );
        }
      }

      return created;
    });

    return NextResponse.json({ product: product.toJSON() }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create product.";
    if (message === "Invalid collection selection.") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message === "Invalid media order.") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create product." },
      { status: 500 },
    );
  }
}
