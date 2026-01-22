import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { Customer, Order } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function toNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Donnees invalides." }, { status: 400 });
  }

  const order = await Order.findByPk(id, {
    include: [{ model: Customer, as: "customer" }],
  });
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }
  if (!order.customer) {
    return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
  }

  const payload = body as Record<string, unknown>;
  const email = toNullableString(payload.email);
  if (!email) {
    return NextResponse.json(
      { error: "Email requis." },
      { status: 400 },
    );
  }

  await order.customer.update({
    first_name: toNullableString(payload.first_name),
    last_name: toNullableString(payload.last_name),
    email,
    phone: toNullableString(payload.phone),
    address1: toNullableString(payload.address1),
    address2: toNullableString(payload.address2),
    postal_code: toNullableString(payload.postal_code),
    city: toNullableString(payload.city),
    country: toNullableString(payload.country),
  });

  return NextResponse.json({ customer: order.customer.toJSON() });
}
