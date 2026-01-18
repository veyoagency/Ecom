import { randomBytes } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import type { Transaction } from "sequelize";

import { requireAdmin } from "@/lib/admin";
import { Collection, sequelize } from "@/lib/models";

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
    (await Collection.count({
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

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const body = await request.json().catch(() => null);
  const title = body?.title?.toString().trim() ?? "";

  if (!title) {
    return NextResponse.json(
      { error: "Collection name is required." },
      { status: 400 },
    );
  }

  const baseSlug = slugify(title);
  if (!baseSlug) {
    return NextResponse.json(
      { error: "Invalid collection name." },
      { status: 400 },
    );
  }

  try {
    const collection = await sequelize.transaction(async (transaction) => {
      const slug = await ensureUniqueSlug(baseSlug, transaction);
      return Collection.create(
        {
          title,
          slug,
        },
        { transaction },
      );
    });

    return NextResponse.json(
      { collection: collection.toJSON() },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to create collection." },
      { status: 500 },
    );
  }
}
