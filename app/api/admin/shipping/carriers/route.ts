import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { decryptSecret } from "@/lib/encryption";
import { WebsiteSetting } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SENDCLOUD_BASE_URL = "https://panel.sendcloud.sc/api/v3";

type SendcloudCarrier = {
  code?: string;
  name?: string;
};

type SendcloudOption = {
  carrier?: SendcloudCarrier | null;
};

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const settings = await WebsiteSetting.findOne();
  const publicEncrypted = settings?.sendcloud_public_key_encrypted ?? null;
  const privateEncrypted = settings?.sendcloud_private_key_encrypted ?? null;

  if (!publicEncrypted || !privateEncrypted) {
    return NextResponse.json({ carriers: ["Other"] });
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

  const auth = Buffer.from(`${publicKey}:${privateKey}`).toString("base64");

  try {
    const response = await fetch(`${SENDCLOUD_BASE_URL}/shipping-options`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parcels: [
          {
            weight: {
              value: "1",
              unit: "kg",
            },
          },
        ],
        calculate_quotes: false,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.errors?.[0]?.detail ||
            data?.error ||
            "Failed to load Sendcloud carriers.",
        },
        { status: response.status },
      );
    }

    const options = Array.isArray(data?.data) ? data.data : [];
    const unique = new Map<string, string>();
    options.forEach((option: SendcloudOption) => {
      const code = option.carrier?.code?.trim() ?? "";
      if (code) {
        unique.set(code.toLowerCase(), code);
        return;
      }
      const name = option.carrier?.name?.trim() ?? "";
      if (name) {
        unique.set(name.toLowerCase(), name);
      }
    });

    const carriers = Array.from(unique.values()).sort((a, b) =>
      a.localeCompare(b),
    );
    if (!carriers.includes("Other")) {
      carriers.push("Other");
    }

    return NextResponse.json({ carriers });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Sendcloud carriers.",
      },
      { status: 500 },
    );
  }
}
