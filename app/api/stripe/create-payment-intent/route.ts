import { NextResponse } from "next/server";

import { DiscountCode, Product } from "@/lib/models";
import { resolveShippingSelection } from "@/lib/shipping-options";
import { getStripeClient } from "@/lib/stripe";
import { getOptionalTrimmedString } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CartItemInput = {
  product_id?: number;
  id?: number;
  qty: number;
};

type CreatePaymentIntentPayload = {
  items: CartItemInput[];
  discountCode?: string | null;
  shippingOptionId?: number | null;
};

function getShippingCents() {
  const parsed = Number(process.env.SHIPPING_CENTS ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeItems(items: unknown) {
  const normalized = Array.isArray(items) ? items : [];
  return normalized
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        product_id: Number(record.product_id ?? record.id),
        qty: Number(record.qty),
      };
    })
    .filter(
      (item) =>
        Number.isInteger(item.product_id) &&
        item.product_id > 0 &&
        Number.isInteger(item.qty) &&
        item.qty > 0,
    );
}

export async function POST(request: Request) {
  let payload: CreatePaymentIntentPayload | null = null;
  try {
    payload = (await request.json()) as CreatePaymentIntentPayload;
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400 },
    );
  }

  const items = normalizeItems(payload?.items);
  if (!items.length) {
    return NextResponse.json({ error: "Panier vide." }, { status: 400 });
  }

  const productIds = items.map((item) => item.product_id);
  const products = await Product.findAll({
    where: { id: productIds, active: true },
  });

  if (products.length !== productIds.length) {
    return NextResponse.json(
      { error: "Certains articles sont indisponibles." },
      { status: 400 },
    );
  }

  const productMap = new Map(
    products.map((product) => [Number(product.id), product]),
  );

  const subtotalCents = items.reduce((total, item) => {
    const product = productMap.get(item.product_id);
    if (!product) {
      return total;
    }
    return total + product.price_cents * item.qty;
  }, 0);

  const rawShippingOptionId = Number(payload?.shippingOptionId);
  const shippingOptionId =
    Number.isInteger(rawShippingOptionId) && rawShippingOptionId > 0
      ? rawShippingOptionId
      : null;
  let shippingCents = getShippingCents();
  try {
    const selection = await resolveShippingSelection({
      optionId: shippingOptionId,
      subtotalCents,
      defaultShippingCents: shippingCents,
    });
    shippingCents = selection.shippingCents;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Option de livraison invalide.",
      },
      { status: 400 },
    );
  }
  const discountCode = getOptionalTrimmedString(payload?.discountCode);
  let discount: DiscountCode | null = null;
  let discountCents = 0;
  if (discountCode) {
    discount = await DiscountCode.findOne({
      where: { code: discountCode.toUpperCase(), active: true },
    });
    if (!discount) {
      return NextResponse.json(
        { error: "Code promo invalide." },
        { status: 400 },
      );
    }
    const baseCents = subtotalCents + shippingCents;
    if (discount.discount_type === "percent") {
      const percent = discount.percent_off ?? 0;
      if (percent <= 0 || percent > 100) {
        return NextResponse.json(
          { error: "Code promo invalide." },
          { status: 400 },
        );
      }
      discountCents = Math.round((baseCents * percent) / 100);
    } else {
      const amount = discount.amount_cents ?? 0;
      if (amount <= 0) {
        return NextResponse.json(
          { error: "Code promo invalide." },
          { status: 400 },
        );
      }
      discountCents = amount;
    }
    discountCents = Math.min(discountCents, baseCents);
  }

  const totalCents = subtotalCents + shippingCents - discountCents;
  if (totalCents <= 0) {
    return NextResponse.json(
      { error: "Montant total invalide." },
      { status: 400 },
    );
  }

  try {
    const stripe = await getStripeClient();
    const intent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "eur",
      payment_method_types: ["card"],
      metadata: {
        discount_code: discountCode ? discountCode.toUpperCase() : "",
      },
    });

    if (!intent.client_secret) {
      return NextResponse.json(
        { error: "Impossible de creer le paiement." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amountCents: totalCents,
      currency: "EUR",
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur Stripe." },
      { status: 502 },
    );
  }
}
