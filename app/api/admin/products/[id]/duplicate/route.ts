import { randomBytes } from "crypto";

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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
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

export async function POST(
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

  const product = await Product.findByPk(productId, {
    include: [
      {
        model: ProductImage,
        as: "images",
        attributes: ["url", "position"],
        required: false,
      },
      {
        model: Collection,
        as: "collections",
        attributes: ["id"],
        through: { attributes: [] },
        required: false,
      },
      {
        model: ProductOption,
        as: "options",
        attributes: ["name", "position"],
        required: false,
        include: [
          {
            model: ProductOptionValue,
            as: "values",
            attributes: ["value", "position", "image_url"],
            required: false,
          },
        ],
      },
    ],
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const productJson = product.toJSON() as {
    title: string;
    description_html: string | null;
    price_cents: number;
    compare_at_cents: number | null;
    weight_kg?: string | null;
    active: boolean;
    in_stock?: boolean;
    images?: Array<{ url: string; position: number | null }>;
    collections?: Array<{ id: number }>;
    options?: Array<{
      name: string;
      position: number | null;
      values?: Array<{
        value: string;
        position: number | null;
        image_url?: string | null;
      }>;
    }>;
  };

  const newTitle = `${productJson.title} (Copy)`;
  const baseSlug = slugify(newTitle);
  if (!baseSlug) {
    return NextResponse.json({ error: "Invalid product title." }, { status: 400 });
  }

  try {
    const created = await sequelize.transaction(async (transaction) => {
      const slug = await ensureUniqueSlug(baseSlug, transaction);
      const duplicated = await Product.create(
        {
          title: newTitle,
          slug,
          description_html: productJson.description_html,
          price_cents: productJson.price_cents,
          compare_at_cents: productJson.compare_at_cents,
          weight_kg: productJson.weight_kg ?? null,
          active: false,
          in_stock: productJson.in_stock ?? true,
        },
        { transaction },
      );

      const collectionIds =
        productJson.collections?.map((collection) => collection.id) ?? [];
      if (collectionIds.length > 0) {
        await ProductCollection.bulkCreate(
          collectionIds.map((collectionId) => ({
            product_id: duplicated.id,
            collection_id: collectionId,
          })),
          { transaction },
        );
      }

      const images = productJson.images ?? [];
      if (images.length > 0) {
        await ProductImage.bulkCreate(
          images.map((image) => ({
            product_id: duplicated.id,
            url: image.url,
            position: image.position ?? 0,
          })),
          { transaction },
        );
      }

      const options = productJson.options ?? [];
      for (const [optionIndex, option] of options.entries()) {
        const createdOption = await ProductOption.create(
          {
            product_id: duplicated.id,
            name: option.name,
            position: option.position ?? optionIndex,
          },
          { transaction },
        );
        const values = option.values ?? [];
        if (values.length > 0) {
          await ProductOptionValue.bulkCreate(
            values.map((value, valueIndex) => ({
              option_id: createdOption.id,
              value: value.value,
              image_url: value.image_url ?? null,
              position: value.position ?? valueIndex,
            })),
            { transaction },
          );
        }
      }

      return duplicated;
    });

    return NextResponse.json({ product: created.toJSON() }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to duplicate product." },
      { status: 500 },
    );
  }
}
