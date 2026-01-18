import path from "path";

import { NextRequest, NextResponse } from "next/server";
import { Sequelize } from "sequelize";

import { requireAdmin } from "@/lib/admin";
import {
  Collection,
  Op,
  Product,
  ProductCollection,
  ProductImage,
  ProductOption,
  ProductOptionValue,
  sequelize,
} from "@/lib/models";
import {
  deleteFromSupabaseStorageByUrl,
  uploadToSupabaseStorage,
} from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIA_FOLDER = "product";

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function saveMediaFile(file: File, baseName: string, position: number) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const originalExt = path.extname(file.name || "").toLowerCase();
  const ext = originalExt || extensionFromType(file.type) || ".bin";
  const safeBase = slugify(baseName) || "product";
  const filename = `${safeBase}-${position + 1}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}${ext}`;
  const objectPath = `${MEDIA_FOLDER}/${filename}`;

  return uploadToSupabaseStorage(
    objectPath,
    buffer,
    file.type || undefined,
  );
}

function parseVariantPayload(raw: string) {
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid variants payload.");
  }
  return parsed
    .map((option: { name?: string; values?: string[] }) => ({
      name: option?.name?.toString().trim() ?? "",
      values: Array.isArray(option?.values)
        ? option.values
            .map((value) => value?.toString().trim() ?? "")
            .filter(Boolean)
        : [],
    }))
    .filter((option) => option.name && option.values.length > 0);
}

function parseMediaOrder(raw: string | null) {
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid media order.");
  }
  return parsed.map((entry) => entry?.toString().trim() ?? "");
}

async function getUnusedUrls(urls: string[]) {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  if (unique.length === 0) return [];

  const rows = await ProductImage.findAll({
    attributes: [
      "url",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
    ],
    where: {
      url: {
        [Op.in]: unique,
      },
    },
    group: ["url"],
  });

  const usage = new Map<string, number>();
  rows.forEach((row) => {
    const data = row.toJSON() as Record<string, unknown>;
    const url = data.url?.toString() ?? "";
    const count = Number(data.count ?? 0);
    if (url) {
      usage.set(url, count);
    }
  });

  return unique.filter((url) => (usage.get(url) ?? 0) === 0);
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
  const productId = Number(id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  }

  const product = await Product.findByPk(productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const title = formData.get("title")?.toString().trim() ?? "";
  const description = formData.get("description")?.toString().trim() ?? "";
  const priceRaw = formData.get("price")?.toString().trim() ?? "";
  const compareAtRaw = formData.get("compare_at")?.toString().trim() ?? "";
  const status = formData.get("status")?.toString() ?? "active";
  const slugRaw = formData.get("slug")?.toString().trim() ?? "";
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

  let nextSlug = product.slug;
  if (slugRaw) {
    const candidate = slugify(slugRaw);
    if (!candidate) {
      return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
    }
    if (candidate !== product.slug) {
      const existing = await Product.count({
        where: { slug: candidate, id: { [Op.ne]: product.id } },
      });
      if (existing > 0) {
        return NextResponse.json(
          { error: "Slug already in use." },
          { status: 400 },
        );
      }
    }
    nextSlug = candidate;
  } else {
    return NextResponse.json({ error: "Slug is required." }, { status: 400 });
  }

  let variantOptions: Array<{ name: string; values: string[] }> = [];
  try {
    variantOptions = parseVariantPayload(variantsRaw);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid variants payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let mediaOrder: string[] = [];
  try {
    mediaOrder = parseMediaOrder(mediaOrderRaw);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid media order.";
    return NextResponse.json({ error: message }, { status: 400 });
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
      if (entry.startsWith("existing:")) return false;
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

  let removedImageUrls: string[] = [];
  try {
    const updated = await sequelize.transaction(async (transaction) => {
      const existingImages = await ProductImage.findAll({
        attributes: ["url"],
        where: { product_id: product.id },
        transaction,
      });
      const existingUrls = existingImages.map((image) => image.url);

      await product.update(
        {
          title,
          slug: nextSlug,
          description_html: description,
          price_cents: priceCents,
          compare_at_cents: compareAtCents,
          active,
        },
        { transaction },
      );

      await ProductCollection.destroy({
        where: { product_id: product.id },
        transaction,
      });

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
            product_id: product.id,
            collection_id: collectionId,
          })),
          { transaction },
        );
      }

      const options = await ProductOption.findAll({
        attributes: ["id"],
        where: { product_id: product.id },
        transaction,
      });
      const optionIds = options.map((option) => option.id);
      if (optionIds.length > 0) {
        await ProductOptionValue.destroy({
          where: { option_id: optionIds },
          transaction,
        });
      }
      await ProductOption.destroy({
        where: { product_id: product.id },
        transaction,
      });

      if (variantOptions.length > 0) {
        for (const [optionIndex, option] of variantOptions.entries()) {
          const createdOption = await ProductOption.create(
            {
              product_id: product.id,
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

      const keptUrls = new Set<string>();
      if (mediaOrder.length > 0) {
        for (const entry of mediaOrder) {
          if (entry.startsWith("existing:")) {
            const url = entry.slice("existing:".length).trim();
            if (url) {
              keptUrls.add(url);
            }
          }
        }
      }

      removedImageUrls = existingUrls.filter((url) => !keptUrls.has(url));

      await ProductImage.destroy({
        where: { product_id: product.id },
        transaction,
      });

      const mediaRecords: Array<{
        product_id: number;
        url: string;
        position: number;
      }> = [];

      if (mediaOrder.length > 0) {
        for (const entry of mediaOrder) {
          if (entry.startsWith("existing:")) {
            const url = entry.slice("existing:".length).trim();
            if (url) {
              mediaRecords.push({
                product_id: product.id,
                url,
                position: mediaRecords.length,
              });
            }
            continue;
          }
          if (entry.startsWith("new:")) {
            const index = Number(entry.slice(4));
            const file = mediaEntries[index];
            if (!file) {
              throw new Error("Invalid media order.");
            }
            const url = await saveMediaFile(file, title, mediaRecords.length);
            mediaRecords.push({
              product_id: product.id,
              url,
              position: mediaRecords.length,
            });
          }
        }
      } else {
        for (const [index, file] of mediaEntries.entries()) {
          const url = await saveMediaFile(file, title, index);
          mediaRecords.push({
            product_id: product.id,
            url,
            position: index,
          });
        }
      }

      if (mediaRecords.length > 0) {
        await ProductImage.bulkCreate(mediaRecords, { transaction });
      }

      return product;
    });

    if (removedImageUrls.length > 0) {
      const unused = await getUnusedUrls(removedImageUrls);
      await Promise.all(
        unused.map((url) =>
          deleteFromSupabaseStorageByUrl(url).catch(() => undefined),
        ),
      );
    }

    return NextResponse.json({ product: updated.toJSON() }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update product.";
    if (message === "Invalid collection selection.") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message === "Invalid media order.") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update product." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  }

  const product = await Product.findByPk(productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  try {
    const existingImages = await ProductImage.findAll({
      attributes: ["url"],
      where: { product_id: product.id },
    });
    const existingUrls = existingImages.map((image) => image.url);

    await sequelize.transaction(async (transaction) => {
      const options = await ProductOption.findAll({
        attributes: ["id"],
        where: { product_id: product.id },
        transaction,
      });
      const optionIds = options.map((option) => option.id);
      if (optionIds.length > 0) {
        await ProductOptionValue.destroy({
          where: { option_id: optionIds },
          transaction,
        });
      }
      await ProductOption.destroy({
        where: { product_id: product.id },
        transaction,
      });
      await ProductCollection.destroy({
        where: { product_id: product.id },
        transaction,
      });
      await ProductImage.destroy({
        where: { product_id: product.id },
        transaction,
      });
      await product.destroy({ transaction });
    });

    if (existingUrls.length > 0) {
      const unused = await getUnusedUrls(existingUrls);
      await Promise.all(
        unused.map((url) =>
          deleteFromSupabaseStorageByUrl(url).catch(() => undefined),
        ),
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete product." },
      { status: 500 },
    );
  }
}
