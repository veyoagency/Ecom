import { randomBytes } from "crypto";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { WebsiteSetting, sequelize } from "@/lib/models";
import {
  deleteFromSupabaseStorageByUrl,
  uploadToSupabaseStorage,
} from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGO_FOLDER = "settings";

function extensionFromType(type: string) {
  if (type === "image/jpeg") return ".jpg";
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  return "";
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const formData = await request.formData();
  const file = formData.get("logo");
  const variantRaw = formData.get("variant")?.toString().trim();
  const variant = variantRaw === "transparent" ? "transparent" : "default";
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Logo file missing." }, { status: 400 });
  }
  if (!file.type?.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image files are allowed." },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const originalExt = path.extname(file.name || "").toLowerCase();
  const ext = originalExt || extensionFromType(file.type) || ".bin";
  const filename = `logo-${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
  const objectPath = `${LOGO_FOLDER}/${filename}`;

  let previousLogo: string | null = null;

  try {
    const logoUrl = await uploadToSupabaseStorage(
      objectPath,
      buffer,
      file.type || undefined,
    );

    const updated = await sequelize.transaction(async (transaction) => {
      const existing = await WebsiteSetting.findOne({ transaction });
      if (existing) {
        if (variant === "transparent") {
          previousLogo = existing.logo_transparent_url ?? null;
          await existing.update(
            { logo_transparent_url: logoUrl },
            { transaction },
          );
        } else {
          previousLogo = existing.logo_url ?? null;
          await existing.update({ logo_url: logoUrl }, { transaction });
        }
        return existing;
      }
      return WebsiteSetting.create(
        variant === "transparent"
          ? { logo_transparent_url: logoUrl }
          : { logo_url: logoUrl },
        { transaction },
      );
    });

    if (previousLogo) {
      await deleteFromSupabaseStorageByUrl(previousLogo).catch(() => undefined);
    }

    return NextResponse.json({
      logoUrl:
        variant === "transparent"
          ? updated.logo_transparent_url ?? logoUrl
          : updated.logo_url ?? logoUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload logo.";
    return NextResponse.json(
      { error: message || "Failed to upload logo." },
      { status: 500 },
    );
  }
}
