import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { WebsiteSetting, sequelize } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const settings = await WebsiteSetting.findOne();

  return NextResponse.json({
    settings: settings ? settings.toJSON() : null,
  });
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const body = await request.json().catch(() => null);
  const storeName = body?.storeName?.toString().trim() ?? "";
  const domain = body?.domain?.toString().trim() ?? "";
  const websiteTitle = body?.websiteTitle?.toString().trim() ?? "";
  const websiteDescription = body?.websiteDescription?.toString().trim() ?? "";
  const defaultCurrency = body?.defaultCurrency?.toString().trim() ?? "";
  const brevoApiKey = body?.brevoApiKey?.toString().trim() ?? "";

  if (!storeName) {
    return NextResponse.json(
      { error: "Store name is required." },
      { status: 400 },
    );
  }

  if (!defaultCurrency) {
    return NextResponse.json(
      { error: "Default currency is required." },
      { status: 400 },
    );
  }

  try {
    const updated = await sequelize.transaction(async (transaction) => {
      const existing = await WebsiteSetting.findOne({ transaction });
      if (existing) {
        await existing.update(
          {
            store_name: storeName,
            domain: domain || null,
            website_title: websiteTitle || null,
            website_description: websiteDescription || null,
            default_currency: defaultCurrency,
            brevo_api_key: brevoApiKey || null,
          },
          { transaction },
        );
        return existing;
      }
      return WebsiteSetting.create(
        {
          store_name: storeName,
          domain: domain || null,
          website_title: websiteTitle || null,
          website_description: websiteDescription || null,
          default_currency: defaultCurrency,
          brevo_api_key: brevoApiKey || null,
        },
        { transaction },
      );
    });

    return NextResponse.json({ settings: updated.toJSON() }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to update settings." },
      { status: 500 },
    );
  }
}
