import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/lib/constants";
import { Sequelize } from "sequelize";

import { Order, OrderItem } from "@/lib/models";
import { parseInteger } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  let status: OrderStatus | null = null;
  if (statusParam) {
    if (!ORDER_STATUSES.includes(statusParam as OrderStatus)) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
    }
    status = statusParam as OrderStatus;
  }

  const limit = parseInteger(searchParams.get("limit"), DEFAULT_PAGE_SIZE, {
    min: 1,
    max: MAX_PAGE_SIZE,
  });
  const offset = parseInteger(searchParams.get("offset"), 0, { min: 0 });

  const orders = await Order.findAll({
    where: status ? { status } : undefined,
    attributes: [
      "id",
      "public_id",
      "status",
      "email",
      "total_cents",
      "created_at",
      "updated_at",
      [Sequelize.fn("COUNT", Sequelize.col("items.id")), "items_count"],
    ],
    include: [
      {
        model: OrderItem,
        as: "items",
        attributes: [],
      },
    ],
    group: ["Order.id"],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    subQuery: false,
  });

  const payload = orders.map((order) => {
    const data = order.toJSON() as Record<string, unknown>;
    return {
      ...data,
      items_count: Number(data.items_count ?? 0),
    };
  });

  return NextResponse.json({ orders: payload, limit, offset });
}
