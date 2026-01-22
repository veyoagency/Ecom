import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { decryptSecret } from "@/lib/encryption";
import { WebsiteSetting } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ORIGIN = "https://panel.sendcloud.sc";
const ALLOWED_PATH_PREFIX = "/api/v3/";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const urlParam = request.nextUrl.searchParams.get("url") ?? "";
  let targetUrl: URL;
  try {
    targetUrl = new URL(urlParam);
  } catch {
    return NextResponse.json({ error: "Invalid label URL." }, { status: 400 });
  }

  if (
    targetUrl.origin !== ALLOWED_ORIGIN ||
    !targetUrl.pathname.startsWith(ALLOWED_PATH_PREFIX)
  ) {
    return NextResponse.json({ error: "Unsupported label URL." }, { status: 400 });
  }

  const settings = await WebsiteSetting.findOne();
  const publicEncrypted = settings?.sendcloud_public_key_encrypted ?? null;
  const privateEncrypted = settings?.sendcloud_private_key_encrypted ?? null;
  if (!publicEncrypted || !privateEncrypted) {
    return NextResponse.json(
      { error: "Sendcloud keys are missing." },
      { status: 400 },
    );
  }

  let publicKey = "";
  let privateKey = "";
  try {
    publicKey = decryptSecret(publicEncrypted);
    privateKey = decryptSecret(privateEncrypted);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to decrypt Sendcloud keys.",
      },
      { status: 500 },
    );
  }

  const authToken = Buffer.from(`${publicKey}:${privateKey}`).toString("base64");

  try {
    const response = await fetch(targetUrl.toString(), {
      headers: {
        Authorization: `Basic ${authToken}`,
      },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return NextResponse.json(
        {
          error:
            data?.errors?.[0]?.detail ||
            data?.error ||
            "Failed to fetch label.",
        },
        { status: response.status },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") ?? "application/pdf";

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "attachment; filename=label.pdf",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch label.",
      },
      { status: 500 },
    );
  }
}
