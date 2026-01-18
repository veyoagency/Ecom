import { NextResponse } from "next/server";

import { Order, OrderItem } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: { publicId: string } },
) {
  const { publicId } = context.params;

  const order = await Order.findOne({
    where: { public_id: publicId },
    attributes: [
      "public_id",
      "status",
      "subtotal_cents",
      "shipping_cents",
      "discount_cents",
      "total_cents",
      "paid_at",
      "created_at",
      "updated_at",
    ],
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
