import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { Order, OrderItem } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const id = parseId(context.params.id);
  if (!id) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const order = await Order.findByPk(id, {
    include: [
      {
        model: OrderItem,
        as: "items",
        attributes: [
          "id",
          "product_id",
          "title_snapshot",
          "unit_price_cents_snapshot",
          "qty",
        ],
      },
    ],
    order: [[{ model: OrderItem, as: "items" }, "id", "ASC"]],
  });
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  return NextResponse.json({ order: order.toJSON() });
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const id = parseId(context.params.id);
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

  const status = (body as Record<string, unknown>).status;
  if (typeof status !== "string" || !ORDER_STATUSES.includes(status as OrderStatus)) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  const order = await Order.findByPk(id);
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  order.status = status;
  if (status === "paid" && !order.paid_at) {
    order.paid_at = new Date();
  }
  await order.save();

  return NextResponse.json({ order: order.toJSON() });
}
