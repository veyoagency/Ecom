import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { decryptSecret } from "@/lib/encryption";
import { DEFAULT_COUNTRY } from "@/lib/constants";
import { WebsiteSetting } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SENDCLOUD_SHIPPING_OPTIONS_URL =
  "https://panel.sendcloud.sc/api/v3/shipping-options";

type QuoteOption = {
  code: string;
  name: string;
  carrierName: string | null;
  price: { value: string; currency: string } | null;
  leadTime: number | null;
  lastMile: string | null;
  requiresServicePoint: boolean;
};

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const body = await request.json().catch(() => null);
  const toCountryCode = body?.toCountryCode?.toString().trim().toUpperCase() ?? "";
  const toPostalCode = body?.toPostalCode?.toString().trim() ?? "";
  const carrierCode = body?.carrierCode?.toString().trim() ?? "";
  const totalWeightKg = Number(body?.totalWeightKg ?? 0);

  if (!toCountryCode || !toPostalCode) {
    return NextResponse.json(
      { error: "Shipping destination is missing." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(totalWeightKg) || totalWeightKg <= 0) {
    return NextResponse.json({ error: "Invalid weight." }, { status: 400 });
  }

  if (!carrierCode || carrierCode.toLowerCase() === "other") {
    return NextResponse.json({ options: [] });
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
  const payload = {
    from_country_code: DEFAULT_COUNTRY,
    to_country_code: toCountryCode,
    to_postal_code: toPostalCode,
    parcels: [
      {
        weight: {
          value: totalWeightKg.toFixed(3),
          unit: "kg",
        },
      },
    ],
    carrier_code: carrierCode,
    calculate_quotes: true,
  };

  try {
    const response = await fetch(SENDCLOUD_SHIPPING_OPTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.errors?.[0]?.detail ||
            data?.error ||
            "Failed to load quotes.",
        },
        { status: response.status },
      );
    }

    const options: QuoteOption[] = Array.isArray(data?.data)
      ? data.data.map((option: any) => {
          const quote = Array.isArray(option?.quotes) ? option.quotes[0] : null;
          const price = quote?.price?.total
            ? {
                value: quote.price.total.value?.toString() ?? "",
                currency: quote.price.total.currency?.toString() ?? "EUR",
              }
            : null;
          return {
            code: option?.code?.toString() ?? "",
            name: option?.name?.toString() ?? "",
            carrierName: option?.carrier?.name?.toString() ?? null,
            price,
            leadTime:
              typeof quote?.lead_time === "number" ? quote.lead_time : null,
            lastMile: option?.functionalities?.last_mile?.toString() ?? null,
            requiresServicePoint: Boolean(
              option?.requirements?.is_service_point_required,
            ),
          };
        })
      : [];

    return NextResponse.json({ options });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load quotes.",
      },
      { status: 500 },
    );
  }
}
