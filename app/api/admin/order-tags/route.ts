import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { OrderTag } from "@/lib/models";
import { getOptionalTrimmedString } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const tags = await OrderTag.findAll({
    attributes: ["id", "name"],
    order: [["name", "ASC"]],
  });

  return NextResponse.json({ tags });
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
  const name = getOptionalTrimmedString(record.name);
  if (!name) {
    return NextResponse.json({ error: "Tag name is required." }, { status: 400 });
  }

  const existing = await OrderTag.findOne({ where: { name } });
  if (existing) {
    return NextResponse.json({ tag: existing });
  }

  const tag = await OrderTag.create({ name });
  return NextResponse.json({ tag });
}

export async function DELETE(request: Request) {
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
  const id = Number(record.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid tag id." }, { status: 400 });
  }

  const tag = await OrderTag.findByPk(id);
  if (!tag) {
    return NextResponse.json({ error: "Tag not found." }, { status: 404 });
  }

  await tag.destroy();
  return NextResponse.json({ ok: true });
}
