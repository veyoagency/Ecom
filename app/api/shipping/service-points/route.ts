import { NextResponse } from "next/server";

import { decryptSecret } from "@/lib/encryption";
import { WebsiteSetting } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SENDCLOUD_SERVICE_POINT_URL =
  "https://servicepoints.sendcloud.sc/api/v2/service-points";

type ServicePointResponse = {
  id: number;
  name: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  distance?: number | null;
  formatted_opening_times?: Record<string, string[]> | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country")?.trim().toUpperCase() || "FR";
  const address = searchParams.get("address")?.trim() || "";
  const postalCode = searchParams.get("postal_code")?.trim() || "";
  const city = searchParams.get("city")?.trim() || "";
  const carrier = searchParams.get("carrier")?.trim() || "";

  if (!address || !postalCode || !city) {
    return NextResponse.json(
      { error: "Address, postal code, and city are required." },
      { status: 400 },
    );
  }

  const settings = await WebsiteSetting.findOne();
  const publicEncrypted = settings?.sendcloud_public_key_encrypted ?? null;
  if (!publicEncrypted) {
    return NextResponse.json(
      { error: "Sendcloud key is missing." },
      { status: 400 },
    );
  }

  let publicKey = "";
  try {
    publicKey = decryptSecret(publicEncrypted);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to decrypt Sendcloud key.",
      },
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    country,
    address,
    city,
    postal_code: postalCode,
    access_token: publicKey,
  });
  if (carrier) {
    params.set("carrier", carrier);
  }

  try {
    const response = await fetch(`${SENDCLOUD_SERVICE_POINT_URL}?${params}`, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Failed to load service points." },
        { status: response.status },
      );
    }
    const points: ServicePointResponse[] = Array.isArray(data)
      ? data.map((point: any) => {
          const distanceValue =
            typeof point.distance === "number"
              ? point.distance
              : Number.parseFloat(point.distance);
          const distance = Number.isFinite(distanceValue) ? distanceValue : null;
          const openingTimes =
            point.formatted_opening_times &&
            typeof point.formatted_opening_times === "object"
              ? point.formatted_opening_times
              : null;
          return {
            id: point.id,
            name: point.name,
            street: point.street,
            house_number: point.house_number,
            postal_code: point.postal_code,
            city: point.city,
            distance,
            formatted_opening_times: openingTimes,
          };
        })
      : [];
    points.sort(
      (left, right) =>
        (left.distance ?? Number.POSITIVE_INFINITY) -
        (right.distance ?? Number.POSITIVE_INFINITY),
    );
    return NextResponse.json({ servicePoints: points });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load service points.",
      },
      { status: 500 },
    );
  }
}
