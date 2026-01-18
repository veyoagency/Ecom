import { NextResponse } from "next/server";

import { WebsiteSetting } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await WebsiteSetting.findOne();

  return NextResponse.json({
    settings: settings
      ? {
          store_name: settings.store_name,
          logo_url: settings.logo_url,
          logo_transparent_url: settings.logo_transparent_url,
        }
      : null,
  });
}
