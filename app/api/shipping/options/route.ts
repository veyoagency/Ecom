import { NextResponse } from "next/server";

import { ShippingOption } from "@/lib/models";
import { isWithinOrderTotal } from "@/lib/shipping-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSubtotalCents(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subtotalCents = parseSubtotalCents(searchParams.get("subtotalCents"));

  const options = await ShippingOption.findAll({
    order: [
      ["position", "ASC"],
      ["created_at", "ASC"],
    ],
  });

  const filtered =
    subtotalCents === null
      ? options
      : options.filter((option) => isWithinOrderTotal(option, subtotalCents));

  return NextResponse.json({ options: filtered });
}
