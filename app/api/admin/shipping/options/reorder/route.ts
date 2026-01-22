import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { ShippingOption, sequelize } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseIds(value: unknown) {
  if (!Array.isArray(value)) return null;
  const ids = value
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) return null;
  const unique = Array.from(new Set(ids));
  return unique.length === ids.length ? ids : null;
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

  const ids = parseIds((payload as Record<string, unknown>)?.ids);
  if (!ids) {
    return NextResponse.json({ error: "Invalid ids." }, { status: 400 });
  }

  const options = await ShippingOption.findAll({ where: { id: ids } });
  if (options.length !== ids.length) {
    return NextResponse.json(
      { error: "Shipping options not found." },
      { status: 404 },
    );
  }

  await sequelize.transaction(async (transaction) => {
    for (const [index, id] of ids.entries()) {
      await ShippingOption.update(
        { position: index + 1 },
        { where: { id }, transaction },
      );
    }
  });

  return NextResponse.json({ ok: true });
}
