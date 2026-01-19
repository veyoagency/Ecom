import { NextResponse } from "next/server";

import { DiscountCode } from "@/lib/models";
import { getOptionalTrimmedString } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ValidatePayload = {
  code: string;
  subtotalCents: number;
};

function calculateDiscountCents(
  subtotalCents: number,
  discount: DiscountCode,
) {
  const baseCents = Math.max(0, Math.round(subtotalCents));
  if (baseCents === 0) return 0;
  let discountCents = 0;
  if (discount.discount_type === "percent") {
    const percent = discount.percent_off ?? 0;
    discountCents = Math.round((baseCents * percent) / 100);
  } else {
    discountCents = discount.amount_cents ?? 0;
  }
  return Math.min(Math.max(discountCents, 0), baseCents);
}

export async function POST(request: Request) {
  let payload: ValidatePayload | null = null;
  try {
    payload = (await request.json()) as ValidatePayload;
  } catch {
    return NextResponse.json(
      { valid: false, error: "Corps JSON invalide." },
      { status: 400 },
    );
  }

  const code = getOptionalTrimmedString(payload?.code);
  const subtotalCents = Number(payload?.subtotalCents ?? 0);

  if (!code) {
    return NextResponse.json(
      { valid: false, error: "Code requis." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(subtotalCents) || subtotalCents < 0) {
    return NextResponse.json(
      { valid: false, error: "Sous-total invalide." },
      { status: 400 },
    );
  }

  const normalizedCode = code.toUpperCase();
  const discount = await DiscountCode.findOne({
    where: { code: normalizedCode, active: true },
  });

  if (!discount) {
    return NextResponse.json(
      { valid: false, error: "Code invalide." },
      { status: 404 },
    );
  }

  const discountCents = calculateDiscountCents(subtotalCents, discount);

  return NextResponse.json({
    valid: true,
    discount_cents: discountCents,
    discount: {
      code: discount.code,
      discount_type: discount.discount_type,
      amount_cents: discount.amount_cents,
      percent_off: discount.percent_off,
    },
  });
}
