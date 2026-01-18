import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { DiscountCode } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  const active = (body as { active?: unknown }).active;
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  const discount = await DiscountCode.findByPk(id);
  if (!discount) {
    return NextResponse.json({ error: "Code promo introuvable." }, { status: 404 });
  }

  discount.active = active;
  await discount.save();

  return NextResponse.json({
    discount: {
      id: discount.id,
      code: discount.code,
      discount_type: discount.discount_type,
      amount_cents: discount.amount_cents,
      percent_off: discount.percent_off,
      active: discount.active,
      created_at: discount.created_at,
    },
  });
}
