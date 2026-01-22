import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { DEFAULT_COUNTRY } from "@/lib/constants";
import { decryptSecret } from "@/lib/encryption";
import { Customer, Order, WebsiteSetting } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SENDCLOUD_BASE_URL = "https://panel.sendcloud.sc/api/v3";

type SenderAddress = Record<string, string>;

class SendcloudError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function formatCurrencyValue(cents: number) {
  return (Math.max(cents, 0) / 100).toFixed(2);
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

function toNonEmptyString(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

function compactRecord<T extends Record<string, unknown>>(record: T) {
  const cleaned: Record<string, string> = {};
  Object.entries(record).forEach(([key, value]) => {
    const text = toNonEmptyString(value);
    if (text) {
      cleaned[key] = text;
    }
  });
  return cleaned;
}

function normalizeSenderAddress(raw: Record<string, any> | null) {
  if (!raw) return null;
  const name =
    toNonEmptyString(raw.name) ||
    toNonEmptyString(raw.contact_name) ||
    toNonEmptyString(raw.company_name) ||
    "Sender";
  const addressLine1 = toNonEmptyString(raw.address_line_1 ?? raw.street);
  const postalCode = toNonEmptyString(raw.postal_code);
  const city = toNonEmptyString(raw.city);
  const rawCountry = toNonEmptyString(raw.country_code)?.toUpperCase() ?? "";
  const countryCode = rawCountry.length === 2 ? rawCountry : DEFAULT_COUNTRY;

  if (!addressLine1 || !postalCode || !city) {
    return null;
  }

  const address: SenderAddress = {
    name,
    company_name: toNonEmptyString(raw.company_name) ?? null,
    address_line_1: addressLine1,
    address_line_2: toNonEmptyString(raw.address_line_2) ?? null,
    house_number: toNonEmptyString(raw.house_number) ?? null,
    postal_code: postalCode,
    city,
    country_code: countryCode,
    phone_number: toNonEmptyString(raw.phone_number ?? raw.telephone) ?? null,
    email: toNonEmptyString(raw.email) ?? null,
    po_box: toNonEmptyString(raw.po_box) ?? null,
  };

  return compactRecord(address);
}

async function fetchSenderAddress(authToken: string) {
  const response = await fetch(
    `${SENDCLOUD_BASE_URL}/addresses/sender-addresses?page_size=100`,
    {
      headers: {
        Authorization: `Basic ${authToken}`,
      },
    },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new SendcloudError(
      data?.errors?.[0]?.detail ||
        data?.error ||
        `Failed to load sender address (status ${response.status}).`,
      response.status,
    );
  }

  const list = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
      ? data
      : [];
  if (!list.length) return null;

  const preferred =
    list.find((entry: any) => entry?.is_default) ??
    list.find((entry: any) => entry?.default) ??
    list[0];
  return normalizeSenderAddress(preferred ?? null);
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const body = await request.json().catch(() => null);
  const orderPublicId = body?.orderPublicId?.toString().trim() ?? "";
  const shippingOptionCode = body?.shippingOptionCode?.toString().trim() ?? "";
  const totalWeightKg = Number(body?.totalWeightKg ?? 0);

  if (!orderPublicId) {
    return NextResponse.json(
      { error: "Order is missing." },
      { status: 400 },
    );
  }
  if (!shippingOptionCode) {
    return NextResponse.json(
      { error: "Shipping option is missing." },
      { status: 400 },
    );
  }

  const order = await Order.findOne({
    where: { public_id: orderPublicId },
    include: [{ model: Customer, as: "customer" }],
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const orderData = order.toJSON() as Record<string, any>;
  const customer = orderData.customer as Record<string, any> | null;
  if (!customer) {
    return NextResponse.json(
      { error: "Customer is missing." },
      { status: 400 },
    );
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

  let senderAddress: SenderAddress | null = null;
  try {
    senderAddress = await fetchSenderAddress(authToken);
  } catch (error) {
    if (error instanceof SendcloudError) {
      if (error.status === 404) {
        return NextResponse.json(
          {
            error:
              "Sender address not found in Sendcloud. Add one in your Sendcloud account.",
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load sender address.",
      },
      { status: 502 },
    );
  }

  if (!senderAddress) {
    return NextResponse.json(
      {
        error:
          "Sender address is missing in Sendcloud. Configure one in your Sendcloud account.",
      },
      { status: 400 },
    );
  }

  const toAddressLine1 = toNonEmptyString(customer.address1) ?? "";
  const toPostalCode = toNonEmptyString(customer.postal_code) ?? "";
  const toCity = toNonEmptyString(customer.city) ?? "";
  const rawCountry = toNonEmptyString(customer.country)?.toUpperCase() ?? "";
  const toCountry =
    rawCountry.length === 2 ? rawCountry : DEFAULT_COUNTRY;
  if (!toAddressLine1 || !toPostalCode || !toCity || !toCountry) {
    return NextResponse.json(
      { error: "Shipping address is incomplete." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(totalWeightKg) || totalWeightKg <= 0) {
    return NextResponse.json({ error: "Invalid weight." }, { status: 400 });
  }

  if (
    order.shipping_option_type === "service_points" &&
    !order.service_point_id
  ) {
    return NextResponse.json(
      { error: "Service point is missing for this order." },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> = {
    label_details: {
      mime_type: "application/pdf",
      dpi: 72,
    },
    to_address: compactRecord({
      name:
        `${toNonEmptyString(customer.first_name) ?? ""} ${toNonEmptyString(
          customer.last_name,
        ) ?? ""}`.trim() || "Customer",
      company_name: customer.company_name ?? null,
      address_line_1: toAddressLine1,
      address_line_2: customer.address2 ?? null,
      postal_code: toPostalCode,
      city: toCity,
      country_code: toCountry,
      phone_number: customer.phone ?? null,
      email: customer.email ?? null,
    }),
    from_address: senderAddress,
    ship_with: {
      type: "shipping_option_code",
      properties: {
        shipping_option_code: shippingOptionCode,
      },
    },
    order_number: order.order_number
      ? String(order.order_number)
      : order.public_id,
    total_order_price: {
      currency: settings?.default_currency ?? "EUR",
      value: formatCurrencyValue(order.total_cents ?? 0),
    },
    parcels: [
      {
        weight: {
          value: totalWeightKg.toFixed(3),
          unit: "kg",
        },
      },
    ],
  };
  if (order.shipping_option_type === "service_points" && order.service_point_id) {
    payload.to_service_point = { id: String(order.service_point_id) };
  }

  try {
    const response = await fetch(`${SENDCLOUD_BASE_URL}/shipments/announce`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = data?.errors?.[0]?.detail || data?.error;
      const pointer = data?.errors?.[0]?.source?.pointer;
      const errorMessage = detail
        ? pointer
          ? `${detail} (${pointer})`
          : detail
        : "Failed to create shipping label.";
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status },
      );
    }

    const shipment = data?.data ?? null;
    const parcels = Array.isArray(shipment?.parcels) ? shipment.parcels : [];
    const parcel = parcels[0] ?? null;
    const documents = Array.isArray(parcel?.documents) ? parcel.documents : [];
    const labelDocument = documents.find(
      (doc: any) => doc?.type === "label",
    );
    const parcelStatus =
      parcel?.status?.code?.toString().trim() ||
      parcel?.status?.message?.toString().trim() ||
      null;
    const deliveryStatus = formatDeliveryStatus(parcelStatus);

    const shipmentId = shipment?.id?.toString() ?? null;
    const parcelId =
      parcel && Number.isFinite(Number(parcel.id)) ? Number(parcel.id) : null;
    const labelUrl = labelDocument?.link?.toString() ?? null;
    const trackingNumber = parcel?.tracking_number?.toString() ?? null;
    const trackingUrl = parcel?.tracking_url?.toString() ?? null;

    await order.update({
      status: "fulfilled",
      sendcloud_shipment_id: shipmentId,
      sendcloud_parcel_id: parcelId,
      sendcloud_tracking_number: trackingNumber,
      sendcloud_tracking_url: trackingUrl,
      delivery_status: deliveryStatus,
      shipping_label_reference: shipmentId,
      shipping_label_url: labelUrl,
    });

    return NextResponse.json({
      shipmentId,
      parcelId,
      labelUrl,
      trackingNumber,
      trackingUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create shipping label.",
      },
      { status: 500 },
    );
  }
}
