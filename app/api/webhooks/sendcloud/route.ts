import { NextResponse } from "next/server";

import { Order } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StatusPayload = {
  code?: string | null;
  message?: string | null;
};

function normalizeStatus(value: unknown) {
  const record = value as StatusPayload | null;
  const code =
    record?.code?.toString().trim() ||
    (typeof value === "string" ? value.trim() : "");
  const message = record?.message?.toString().trim() ?? "";
  if (code && message) {
    return `${code} - ${message}`;
  }
  return code || message || null;
}

function formatDeliveryStatus(raw: string | null) {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper.includes("DELIVERED")) return "Delivered";
  if (upper.includes("READY_TO_SEND")) return "Label created";
  if (upper.includes("READY_FOR_PICKUP") || upper.includes("AT_SERVICE_POINT")) {
    return "Ready for pickup";
  }
  if (upper.includes("OUT_FOR_DELIVERY") || upper.includes("IN_TRANSIT")) {
    return "In transit";
  }
  if (upper.includes("PICKED_UP")) return "Picked up";
  if (upper.includes("FAILED_DELIVERY") || upper.includes("DELIVERY_ATTEMPT")) {
    return "Delivery attempt failed";
  }
  if (upper.includes("ANNOUNCEMENT_FAILED")) return "Announcement failed";
  if (upper.includes("EXCEPTION")) return "Exception";
  if (upper.includes("RETURN")) return "Returning";
  if (upper.includes("CANCEL")) return "Cancelled";
  return raw;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const parcel =
    typeof payload.parcel === "object" && payload.parcel !== null
      ? (payload.parcel as Record<string, unknown>)
      : null;
  const parcelId =
    toNumber(payload.parcel_id) ??
    toNumber(parcel?.id) ??
    toNumber(payload.id) ??
    null;
  const trackingNumber =
    payload.tracking_number?.toString().trim() ||
    parcel?.tracking_number?.toString().trim() ||
    "";
  const status =
    normalizeStatus(payload.parcel_status) ||
    normalizeStatus(parcel?.status) ||
    normalizeStatus(payload.status) ||
    null;
  const deliveryStatus = formatDeliveryStatus(status);

  if (!parcelId && !trackingNumber) {
    return NextResponse.json(
      { error: "Parcel identifier is missing." },
      { status: 400 },
    );
  }

  if (!deliveryStatus) {
    return NextResponse.json(
      { error: "Delivery status is missing." },
      { status: 400 },
    );
  }

  const where = parcelId
    ? { sendcloud_parcel_id: parcelId }
    : { sendcloud_tracking_number: trackingNumber };

  await Order.update({ delivery_status: deliveryStatus }, { where });

  return NextResponse.json({ ok: true });
}
