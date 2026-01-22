import { NextResponse } from "next/server";

import { DiscountCode, Product } from "@/lib/models";
import { resolveShippingSelection } from "@/lib/shipping-options";
import { getPayPalAccessToken, getPayPalBaseUrl } from "@/lib/paypal";
import { getOptionalTrimmedString } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CartItemInput = {
  product_id?: number;
  id?: number;
  qty: number;
};

type CreateOrderPayload = {
  items: CartItemInput[];
  discountCode?: string | null;
  shippingOptionId?: number | null;
};

function getShippingCents() {
  const parsed = Number(process.env.SHIPPING_CENTS ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatPayPalAmount(cents: number) {
  const amount = Math.max(0, cents) / 100;
  return amount.toFixed(2);
}

export async function POST(request: Request) {
  let payload: CreateOrderPayload | null = null;
  try {
    payload = (await request.json()) as CreateOrderPayload;
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400 },
    );
  }

  const items = Array.isArray(payload?.items) ? payload?.items : [];
  if (!items.length) {
    return NextResponse.json(
      { error: "Panier vide." },
      { status: 400 },
    );
  }

  const normalizedItems = items
    .map((item) => ({
      product_id: Number(item.product_id ?? item.id),
      qty: Number(item.qty),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.product_id) &&
        item.product_id > 0 &&
        Number.isInteger(item.qty) &&
        item.qty > 0,
    );

  if (!normalizedItems.length) {
    return NextResponse.json(
      { error: "Panier invalide." },
      { status: 400 },
    );
  }

  const productIds = normalizedItems.map((item) => item.product_id);
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

  const subtotalCents = normalizedItems.reduce((total, item) => {
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
  const defaultShippingCents = getShippingCents();
  let shippingCents = defaultShippingCents;
  try {
    const selection = await resolveShippingSelection({
      optionId: shippingOptionId,
      subtotalCents,
      defaultShippingCents,
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
      { error: "Montant invalide." },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "EUR",
              value: formatPayPalAmount(totalCents),
              breakdown: {
                item_total: {
                  currency_code: "EUR",
                  value: formatPayPalAmount(subtotalCents),
                },
                shipping: {
                  currency_code: "EUR",
                  value: formatPayPalAmount(shippingCents),
                },
                ...(discountCents > 0
                  ? {
                      discount: {
                        currency_code: "EUR",
                        value: formatPayPalAmount(discountCents),
                      },
                    }
                  : {}),
              },
            },
            items: normalizedItems.map((item) => {
              const product = productMap.get(item.product_id);
              const unitPrice = product?.price_cents ?? 0;
              return {
                name: product?.title ?? "Produit",
                quantity: String(item.qty),
                unit_amount: {
                  currency_code: "EUR",
                  value: formatPayPalAmount(unitPrice),
                },
              };
            }),
          },
        ],
      }),
    });

    const data = (await response.json()) as { id?: string };
    if (!response.ok || !data.id) {
      return NextResponse.json(
        { error: "Impossible de creer la commande PayPal." },
        { status: 502 },
      );
    }

    return NextResponse.json({ orderId: data.id });
  } catch {
    return NextResponse.json(
      { error: "Erreur PayPal." },
      { status: 502 },
    );
  }
}
