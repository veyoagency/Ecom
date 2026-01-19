import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/email";
import { generatePublicId } from "@/lib/ids";
import { DiscountCode, Order, OrderItem, Product, sequelize } from "@/lib/models";
import { getPayPalAccessToken, getPayPalBaseUrl } from "@/lib/paypal";
import { getOptionalTrimmedString } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CartItemInput = {
  product_id?: number;
  id?: number;
  qty: number;
};

type CapturePayload = {
  orderId: string;
  items: CartItemInput[];
  discountCode?: string | null;
};

type PayPalCaptureResponse = {
  id?: string;
  status?: string;
  payer?: {
    name?: {
      given_name?: string;
      surname?: string;
    };
    email_address?: string;
    phone?: {
      phone_number?: {
        national_number?: string;
      };
    };
  };
  purchase_units?: Array<{
    shipping?: {
      name?: {
        full_name?: string;
      };
      address?: {
        address_line_1?: string;
        address_line_2?: string;
        admin_area_2?: string;
        postal_code?: string;
        country_code?: string;
      };
    };
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
      }>;
    };
  }>;
};

function getShippingCents() {
  const parsed = Number(process.env.SHIPPING_CENTS ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeName(value: string | undefined | null) {
  if (!value) return "";
  return value.trim();
}

function parseFullName(fullName: string | undefined | null) {
  if (!fullName) {
    return { firstName: "", lastName: "" };
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  const firstName = parts.slice(0, -1).join(" ");
  const lastName = parts.slice(-1).join(" ");
  return { firstName, lastName };
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
  let payload: CapturePayload | null = null;
  try {
    payload = (await request.json()) as CapturePayload;
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400 },
    );
  }

  const orderId = getOptionalTrimmedString(payload?.orderId);
  if (!orderId) {
    return NextResponse.json({ error: "Order ID manquant." }, { status: 400 });
  }

  const items = Array.isArray(payload?.items) ? payload?.items : [];
  if (!items.length) {
    return NextResponse.json({ error: "Panier vide." }, { status: 400 });
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

  const shippingCents = getShippingCents();
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

  let capture: PayPalCaptureResponse;
  try {
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(
      `${getPayPalBaseUrl()}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    capture = (await response.json()) as PayPalCaptureResponse;
    if (!response.ok || capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Paiement PayPal invalide." },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Erreur PayPal." },
      { status: 502 },
    );
  }

  const payer = capture.payer;
  const payerName = payer?.name;
  const shipping = capture.purchase_units?.[0]?.shipping;
  const shippingAddress = shipping?.address;
  const captureId =
    capture.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;
  const fullName = normalizeName(shipping?.name?.full_name);
  const parsedName = parseFullName(fullName);

  const firstName =
    normalizeName(payerName?.given_name) || parsedName.firstName || "Client";
  const lastName =
    normalizeName(payerName?.surname) || parsedName.lastName || "PayPal";
  const email = normalizeName(payer?.email_address) || "unknown@example.com";
  const phone = normalizeName(payer?.phone?.phone_number?.national_number) || null;

  const address1 = normalizeName(shippingAddress?.address_line_1) || "N/A";
  const address2 = normalizeName(shippingAddress?.address_line_2) || null;
  const postalCode = normalizeName(shippingAddress?.postal_code) || "N/A";
  const city = normalizeName(shippingAddress?.admin_area_2) || "N/A";
  const country = normalizeName(shippingAddress?.country_code) || "FR";

  const order = await sequelize.transaction(async (transaction) => {
    const publicId = generatePublicId();

    const insertedOrder = await Order.create(
      {
        public_id: publicId,
        status: "paid",
        paypal_order_id: orderId,
        paypal_capture_id: captureId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        address1,
        address2,
        postal_code: postalCode,
        city,
        country,
        preferred_payment_method: "PayPal",
        subtotal_cents: subtotalCents,
        shipping_cents: shippingCents,
        discount_code_id: discount ? discount.id : null,
        discount_cents: discountCents || null,
        total_cents: totalCents,
        paid_at: new Date(),
      },
      { transaction },
    );

    const itemsPayload = normalizedItems.map((item) => {
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

  const emailItems = normalizedItems.map((item) => {
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
      id: order.id,
      public_id: order.public_id,
      total_cents: order.total_cents,
      discount_cents: order.discount_cents ?? 0,
      paypal_order_id: order.paypal_order_id,
      paypal_capture_id: order.paypal_capture_id,
      email_skipped: emailSkipped,
    },
  });
}
