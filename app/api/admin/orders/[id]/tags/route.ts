import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { Order, OrderTag, OrderTagAssignment } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const params = await context.params;
  const order = await Order.findOne({ where: { public_id: params.id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const tags = await OrderTag.findAll({
    attributes: ["id", "name"],
    include: [
      {
        model: Order,
        as: "orders",
        where: { id: order.id },
        attributes: [],
        through: { attributes: [] },
      },
    ],
    order: [["name", "ASC"]],
  });

  return NextResponse.json({ tags });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const params = await context.params;
  const order = await Order.findOne({ where: { public_id: params.id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const record = payload as Record<string, unknown>;
  const tagIds = Array.isArray(record.tagIds)
    ? (record.tagIds as Array<number | string>)
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    : [];

  await OrderTagAssignment.destroy({ where: { order_id: order.id } });

  if (tagIds.length > 0) {
    await OrderTagAssignment.bulkCreate(
      tagIds.map((tagId) => ({
        order_id: order.id,
        tag_id: tagId,
      })),
    );
  }

  const tags = await OrderTag.findAll({
    attributes: ["id", "name"],
    include: [
      {
        model: Order,
        as: "orders",
        where: { id: order.id },
        attributes: [],
        through: { attributes: [] },
      },
    ],
    order: [["name", "ASC"]],
  });

  return NextResponse.json({ tags });
}
