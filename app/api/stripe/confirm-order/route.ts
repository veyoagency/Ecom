import { NextResponse } from "next/server";

import { DEFAULT_COUNTRY } from "@/lib/constants";
import { sendEmail } from "@/lib/email";
import { generatePublicId } from "@/lib/ids";
import { DiscountCode, Order, OrderItem, Product, sequelize } from "@/lib/models";
import { getStripeClient } from "@/lib/stripe";
import {
  getOptionalTrimmedString,
  getTrimmedString,
  isNonEmptyString,
  isValidEmail,
} from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CartItemInput = {
  product_id?: number;
  id?: number;
  qty: number;
};

type ConfirmOrderPayload = {
  paymentIntentId: string;
  items: CartItemInput[];
  discountCode?: string | null;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
  };
  shipping: {
    address1: string;
    address2?: string | null;
    postal_code: string;
    city: string;
    country?: string | null;
  };
};

function normalizeCountry(value: string | null) {
  if (!value) {
    return DEFAULT_COUNTRY;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "FR" || normalized === "FRANCE") {
    return DEFAULT_COUNTRY;
  }

  return null;
}

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

function buildOrderEmail(params: {
  publicId: string;
  firstName: string;
  items: Array<{ title: string; qty: number; unit_price_cents: number }>;
  totalCents: number;
}) {
  const lines = params.items
    .map(
      (item) =>
        `- ${item.title} x${item.qty} (${(item.unit_price_cents / 100).toFixed(2)} EUR)`,
    )
    .join("\n");

  const text = `Bonjour ${params.firstName},\n\nMerci pour votre commande ${params.publicId}.\n\nArticles:\n${lines}\n\nTotal: ${(params.totalCents / 100).toFixed(2)} EUR\n\nNous vous tiendrons informe des prochaines etapes.\n`;

  const itemsHtml = params.items
    .map(
      (item) =>
        `<li>${item.title} x${item.qty} (${(
          item.unit_price_cents / 100
        ).toFixed(2)} EUR)</li>`,
    )
    .join("");

  const html = `
    <p>Bonjour ${params.firstName},</p>
    <p>Merci pour votre commande <strong>${params.publicId}</strong>.</p>
    <p>Articles:</p>
    <ul>${itemsHtml}</ul>
    <p>Total: <strong>${(params.totalCents / 100).toFixed(2)} EUR</strong></p>
    <p>Nous vous tiendrons informe des prochaines etapes.</p>
  `;

  return { text, html };
}

export async function POST(request: Request) {
  let payload: ConfirmOrderPayload | null = null;
  try {
    payload = (await request.json()) as ConfirmOrderPayload;
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400 },
    );
  }

  const paymentIntentId = getTrimmedString(payload?.paymentIntentId);
  const items = normalizeItems(payload?.items);
  const discountCode = getOptionalTrimmedString(payload?.discountCode);

  const customer = payload?.customer ?? ({} as ConfirmOrderPayload["customer"]);
  const shipping = payload?.shipping ?? ({} as ConfirmOrderPayload["shipping"]);

  const firstName = getTrimmedString(customer.first_name);
  const lastName = getTrimmedString(customer.last_name);
  const email = getTrimmedString(customer.email).toLowerCase();
  const phone = getOptionalTrimmedString(customer.phone);

  const address1 = getTrimmedString(shipping.address1);
  const address2 = getOptionalTrimmedString(shipping.address2);
  const postalCode = getTrimmedString(shipping.postal_code);
  const city = getTrimmedString(shipping.city);
  const country = normalizeCountry(getOptionalTrimmedString(shipping.country));

  const errors: string[] = [];
  if (!isNonEmptyString(paymentIntentId)) {
    errors.push("Paiement invalide.");
  }
  if (!isNonEmptyString(firstName)) {
    errors.push("Le prenom est obligatoire.");
  }
  if (!isNonEmptyString(lastName)) {
    errors.push("Le nom est obligatoire.");
  }
  if (!isNonEmptyString(email) || !isValidEmail(email)) {
    errors.push("Email invalide.");
  }
  if (!isNonEmptyString(address1)) {
    errors.push("Adresse de livraison obligatoire.");
  }
  if (!isNonEmptyString(postalCode)) {
    errors.push("Code postal obligatoire.");
  }
  if (!isNonEmptyString(city)) {
    errors.push("Ville obligatoire.");
  }
  if (!country) {
    errors.push("Livraison uniquement en France.");
  }
  if (!items.length) {
    errors.push("Panier vide.");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors }, { status: 400 });
  }

  const existing = await Order.findOne({
    where: { stripe_payment_intent_id: paymentIntentId },
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      order: { public_id: existing.public_id },
    });
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

  const shippingCents = getShippingCents();
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

  let paymentIntentAmount = 0;
  let paymentIntentCurrency = "";
  let latestChargeId: string | null = null;
  let stripeRiskScore: number | null = null;
  let stripeRiskLevel: string | null = null;
  let stripeRiskReason: string | null = null;
  let stripeRiskRule: string | null = null;
  let stripeSellerMessage: string | null = null;
  let stripeOutcomeType: string | null = null;
  let stripeNetworkStatus: string | null = null;
  try {
    const stripe = await getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const charge =
      typeof paymentIntent.latest_charge === "string"
        ? await stripe.charges.retrieve(paymentIntent.latest_charge)
        : paymentIntent.latest_charge ?? null;
    const outcome = charge?.outcome ?? null;
    console.log("Stripe charge outcome:", {
      paymentIntentId,
      chargeId: charge?.id ?? null,
      status: paymentIntent.status,
      outcome,
    });
    if (outcome) {
      stripeRiskScore =
        typeof outcome.risk_score === "number" ? outcome.risk_score : null;
      stripeRiskLevel = outcome.risk_level ?? null;
      stripeRiskReason = outcome.reason ?? null;
      stripeRiskRule = outcome.rule ?? null;
      stripeSellerMessage = outcome.seller_message ?? null;
      stripeOutcomeType = outcome.type ?? null;
      stripeNetworkStatus = outcome.network_status ?? null;
    }
    paymentIntentAmount = paymentIntent.amount;
    paymentIntentCurrency = paymentIntent.currency;
    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Paiement Stripe invalide." },
        { status: 400 },
      );
    }
    if (paymentIntentAmount !== totalCents) {
      return NextResponse.json(
        { error: "Montant Stripe invalide." },
        { status: 400 },
      );
    }
    if (paymentIntentCurrency !== "eur") {
      return NextResponse.json(
        { error: "Devise Stripe invalide." },
        { status: 400 },
      );
    }
    latestChargeId =
      typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id ?? null;
  } catch {
    return NextResponse.json(
      { error: "Erreur Stripe." },
      { status: 502 },
    );
  }

  const order = await sequelize.transaction(async (transaction) => {
    const publicId = generatePublicId();

    const insertedOrder = await Order.create(
      {
        public_id: publicId,
        status: "paid",
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: latestChargeId,
        stripe_risk_score: stripeRiskScore,
        stripe_risk_level: stripeRiskLevel,
        stripe_risk_reason: stripeRiskReason,
        stripe_risk_rule: stripeRiskRule,
        stripe_seller_message: stripeSellerMessage,
        stripe_outcome_type: stripeOutcomeType,
        stripe_network_status: stripeNetworkStatus,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        address1,
        address2,
        postal_code: postalCode,
        city,
        country: country ?? DEFAULT_COUNTRY,
        preferred_payment_method: "Stripe",
        subtotal_cents: subtotalCents,
        shipping_cents: shippingCents,
        discount_code_id: discount ? discount.id : null,
        discount_cents: discountCents || null,
        total_cents: totalCents,
        paid_at: new Date(),
      },
      { transaction },
    );

    const itemsPayload = items.map((item) => {
      const product = productMap.get(item.product_id);
      if (!product) {
        throw new Error("Product missing during order creation.");
      }

      return {
        order_id: insertedOrder.id,
        product_id: item.product_id,
        title_snapshot: product.title,
        unit_price_cents_snapshot: product.price_cents,
        qty: item.qty,
      };
    });

    await OrderItem.bulkCreate(itemsPayload, { transaction });

    return insertedOrder;
  });

  const emailItems = items.map((item) => {
    const product = productMap.get(item.product_id);
    return {
      title: product ? product.title : "Produit",
      qty: item.qty,
      unit_price_cents: product ? product.price_cents : 0,
    };
  });

  const { text, html } = buildOrderEmail({
    publicId: order.public_id,
    firstName,
    items: emailItems,
    totalCents: order.total_cents,
  });

  let emailSkipped = false;
  try {
    const result = await sendEmail({
      to: email,
      subject: `Confirmation de commande ${order.public_id}`,
      text,
      html,
    });
    emailSkipped = result.skipped;
  } catch {
    emailSkipped = true;
  }

  return NextResponse.json({
    ok: true,
    order: {
      public_id: order.public_id,
      total_cents: order.total_cents,
      stripe_payment_intent_id: order.stripe_payment_intent_id,
      stripe_charge_id: order.stripe_charge_id,
      email_skipped: emailSkipped,
    },
  });
}
