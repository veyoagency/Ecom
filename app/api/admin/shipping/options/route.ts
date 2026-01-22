import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { ShippingOption } from "@/lib/models";
import { getOptionalTrimmedString } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHIPPING_TYPES = new Set(["shipping", "clickncollect", "service_points"]);

function parsePrice(value: string | null) {
  if (!value) return null;
  const normalized = value.replace(",", ".");
  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount)) return null;
  if (amount < 0) return null;
  return amount.toFixed(2);
}

function parseOptionalPrice(value: unknown) {
  if (value === null || value === undefined) {
    return { value: null, error: null };
  }
  if (typeof value === "string" && value.trim() === "") {
    return { value: null, error: null };
  }
  const raw =
    typeof value === "number" ? value.toString() : value?.toString() ?? "";
  const parsed = parsePrice(raw);
  if (parsed === null) {
    return { value: null, error: "Invalid price." };
  }
  return { value: parsed, error: null };
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const options = await ShippingOption.findAll({
    order: [
      ["position", "ASC"],
      ["created_at", "ASC"],
    ],
  });

  return NextResponse.json({ options });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const record = payload as Record<string, unknown>;
  const carrier = getOptionalTrimmedString(record.carrier);
  const title = getOptionalTrimmedString(record.title);
  const description = getOptionalTrimmedString(record.description);
  const shippingTypeRaw =
    record.shippingType ?? record.shipping_type ?? record.type ?? null;
  const shippingType = shippingTypeRaw
    ? shippingTypeRaw.toString().trim()
    : null;
  const priceResult = parseOptionalPrice(record.price);
  const minResult = parseOptionalPrice(record.minOrderTotal);
  const maxResult = parseOptionalPrice(record.maxOrderTotal);
  const price = priceResult.value;
  const minOrderTotal = minResult.value;
  const maxOrderTotal = maxResult.value;

  if (!carrier) {
    return NextResponse.json({ error: "Carrier is required." }, { status: 400 });
  }

  if (!shippingType || !SHIPPING_TYPES.has(shippingType)) {
    return NextResponse.json({ error: "Shipping type is required." }, { status: 400 });
  }

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  if (price === null) {
    return NextResponse.json({ error: "Price is required." }, { status: 400 });
  }

  if (minResult.error) {
    return NextResponse.json(
      { error: "Minimum order total is invalid." },
      { status: 400 },
    );
  }

  if (maxResult.error) {
    return NextResponse.json(
      { error: "Maximum order total is invalid." },
      { status: 400 },
    );
  }

  if (
    minOrderTotal !== null &&
    maxOrderTotal !== null &&
    Number.parseFloat(minOrderTotal) > Number.parseFloat(maxOrderTotal)
  ) {
    return NextResponse.json(
      { error: "Minimum order total must be less than the maximum." },
      { status: 400 },
    );
  }

  const maxPositionRaw = await ShippingOption.max("position");
  const maxPosition = Number.isFinite(Number(maxPositionRaw))
    ? Number(maxPositionRaw)
    : 0;

  const option = await ShippingOption.create({
    carrier,
    shipping_type: shippingType,
    title,
    description,
    price,
    min_order_total: minOrderTotal,
    max_order_total: maxOrderTotal,
    position: maxPosition + 1,
  });

  return NextResponse.json({ option });
}
