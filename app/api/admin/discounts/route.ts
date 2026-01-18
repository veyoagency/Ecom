import { NextRequest, NextResponse } from "next/server";
import { Sequelize } from "sequelize";

import { requireAdmin } from "@/lib/admin";
import { DiscountCode, Op, Order } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseAmount(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const parsed = Number(value.toString().trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

function parsePercent(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const parsed = Number(value.toString().trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
    return null;
  }
  return Math.round(parsed);
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const [discounts, usageRows] = await Promise.all([
    DiscountCode.findAll({
      order: [["created_at", "DESC"]],
    }),
    Order.findAll({
      attributes: [
        "discount_code_id",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "usage_count"],
      ],
      where: {
        discount_code_id: {
          [Op.not]: null,
        },
      },
      group: ["discount_code_id"],
    }),
  ]);

  const usageMap = new Map<number, number>();
  usageRows.forEach((row) => {
    const data = row.toJSON() as Record<string, unknown>;
    const id = Number(data.discount_code_id);
    const count = Number(data.usage_count ?? 0);
    if (Number.isFinite(id)) {
      usageMap.set(id, count);
    }
  });

  const payload = discounts.map((discount) => ({
    id: discount.id,
    code: discount.code,
    discount_type: discount.discount_type,
    amount_cents: discount.amount_cents,
    percent_off: discount.percent_off,
    active: discount.active,
    created_at: discount.created_at,
    usage_count: usageMap.get(discount.id) ?? 0,
  }));

  return NextResponse.json({ discounts: payload });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
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

  const codeRaw = (body as { code?: unknown }).code?.toString().trim() ?? "";
  const typeValue = (body as { type?: unknown }).type?.toString().trim();
  const discountType = typeValue === "percent" ? "percent" : "fixed";
  const amountCents = parseAmount((body as { amount?: unknown }).amount);
  const percentOff = parsePercent((body as { percent?: unknown }).percent);
  const activeValue = (body as { active?: unknown }).active;
  const active =
    typeof activeValue === "boolean" ? activeValue : true;

  if (!codeRaw) {
    return NextResponse.json(
      { error: "Le code promo est requis." },
      { status: 400 },
    );
  }

  if (discountType === "fixed") {
    if (!amountCents) {
      return NextResponse.json(
        { error: "Montant invalide." },
        { status: 400 },
      );
    }
  } else if (!percentOff) {
    return NextResponse.json(
      { error: "Pourcentage invalide." },
      { status: 400 },
    );
  }

  const code = codeRaw.toUpperCase();

  try {
    const discount = await DiscountCode.create({
      code,
      discount_type: discountType,
      amount_cents: discountType === "fixed" ? amountCents : null,
      percent_off: discountType === "percent" ? percentOff : null,
      active,
    });

    return NextResponse.json({
      discount: {
        id: discount.id,
        code: discount.code,
        discount_type: discount.discount_type,
        amount_cents: discount.amount_cents,
        percent_off: discount.percent_off,
        active: discount.active,
        created_at: discount.created_at,
        usage_count: 0,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur lors de la creation.";
    return NextResponse.json(
      { error: message || "Erreur lors de la creation." },
      { status: 400 },
    );
  }
}
