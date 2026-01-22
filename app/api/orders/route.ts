import { NextResponse } from "next/server";

import { DEFAULT_COUNTRY } from "@/lib/constants";
import { upsertCustomer } from "@/lib/customers";
import { sendEmail } from "@/lib/email";
import { generatePublicId } from "@/lib/ids";
import { DiscountCode, Order, OrderItem, Product, sequelize } from "@/lib/models";
import { resolveShippingSelection } from "@/lib/shipping-options";
import {
  getOptionalTrimmedString,
  getTrimmedString,
  isNonEmptyString,
  isValidEmail,
} from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderItemInput = {
  product_id: number;
  qty: number;
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

function parseOrderBody(body: unknown) {
  if (typeof body !== "object" || body === null) {
    return { errors: ["Corps JSON invalide."] };
  }

  const record = body as Record<string, unknown>;
  const customer =
    typeof record.customer === "object" && record.customer !== null
      ? (record.customer as Record<string, unknown>)
      : {};
  const shipping =
    typeof record.shipping === "object" && record.shipping !== null
      ? (record.shipping as Record<string, unknown>)
      : {};

  const firstName = getTrimmedString(customer.first_name);
  const lastName = getTrimmedString(customer.last_name);
  const email = getTrimmedString(customer.email).toLowerCase();
  const phone = getOptionalTrimmedString(customer.phone);

  const address1 = getTrimmedString(shipping.address1);
  const address2 = getOptionalTrimmedString(shipping.address2);
  const postalCode = getTrimmedString(shipping.postal_code);
  const city = getTrimmedString(shipping.city);
  const country = normalizeCountry(
    getOptionalTrimmedString(shipping.country),
  );
  const servicePointRecord =
    typeof record.servicePoint === "object" && record.servicePoint !== null
      ? (record.servicePoint as Record<string, unknown>)
      : null;
  const servicePointIdValue = Number(servicePointRecord?.id);
  const servicePointId =
    Number.isInteger(servicePointIdValue) && servicePointIdValue > 0
      ? servicePointIdValue
      : null;
  const servicePointName = getOptionalTrimmedString(servicePointRecord?.name);
  const servicePointStreet = getOptionalTrimmedString(
    servicePointRecord?.street,
  );
  const servicePointHouseNumber = getOptionalTrimmedString(
    servicePointRecord?.house_number,
  );
  const servicePointPostalCode = getOptionalTrimmedString(
    servicePointRecord?.postal_code,
  );
  const servicePointCity = getOptionalTrimmedString(servicePointRecord?.city);
  const servicePointDistanceValue = Number(servicePointRecord?.distance);
  const servicePointDistance = Number.isFinite(servicePointDistanceValue)
    ? Math.round(servicePointDistanceValue)
    : null;

  const preferredPaymentMethod = getTrimmedString(
    record.preferred_payment_method,
  );
  const discountCode = getOptionalTrimmedString(record.discount_code);

  const itemsValue = record.items;
  const rawShippingOptionId = Number(
    record.shippingOptionId ?? record.shipping_option_id,
  );
  const shippingOptionId =
    Number.isInteger(rawShippingOptionId) && rawShippingOptionId > 0
      ? rawShippingOptionId
      : null;

  const errors: string[] = [];
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
  if (!isNonEmptyString(preferredPaymentMethod)) {
    errors.push("Methode de paiement obligatoire.");
  }

  if (!Array.isArray(itemsValue) || itemsValue.length === 0) {
    errors.push("Panier vide.");
  }

  const items: OrderItemInput[] = [];
  if (Array.isArray(itemsValue)) {
    for (const rawItem of itemsValue) {
      if (typeof rawItem !== "object" || rawItem === null) {
        errors.push("Article invalide.");
        continue;
      }

      const itemRecord = rawItem as Record<string, unknown>;
      const productId = Number(itemRecord.product_id);
      const qty = Number(itemRecord.qty);

      if (!Number.isInteger(productId) || productId <= 0) {
        errors.push("Article invalide.");
        continue;
      }

      if (!Number.isInteger(qty) || qty <= 0) {
        errors.push("Quantite invalide.");
        continue;
      }

      items.push({ product_id: productId, qty });
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  const mergedItems = new Map<number, number>();
  for (const item of items) {
    mergedItems.set(item.product_id, (mergedItems.get(item.product_id) ?? 0) + item.qty);
  }

  return {
    data: {
      firstName,
      lastName,
      email,
      phone,
      address1,
      address2,
      postalCode,
      city,
      country: country ?? DEFAULT_COUNTRY,
      preferredPaymentMethod,
      discountCode: discountCode ? discountCode.toUpperCase() : null,
      items: Array.from(mergedItems, ([product_id, qty]) => ({
        product_id,
        qty,
      })),
      shippingOptionId,
      servicePoint: {
        id: servicePointId,
        name: servicePointName,
        street: servicePointStreet,
        house_number: servicePointHouseNumber,
        postal_code: servicePointPostalCode,
        city: servicePointCity,
        distance: servicePointDistance,
      },
    },
  };
}

function getShippingCents() {
  const parsed = Number(process.env.SHIPPING_CENTS ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const parsed = parseOrderBody(body);
  if (!parsed.data) {
    return NextResponse.json({ error: parsed.errors }, { status: 400 });
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    address1,
    address2,
    postalCode,
    city,
    country,
    preferredPaymentMethod,
    items,
    discountCode,
    servicePoint,
  } = parsed.data;

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

  const defaultShippingCents = getShippingCents();
  let shippingCents = defaultShippingCents;
  let shippingOption: Awaited<
    ReturnType<typeof resolveShippingSelection>
  >["option"] = null;
  try {
    const selection = await resolveShippingSelection({
      optionId: parsed.data.shippingOptionId,
      subtotalCents,
      defaultShippingCents,
    });
    shippingCents = selection.shippingCents;
    shippingOption = selection.option;
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
  if (shippingOption?.shipping_type === "service_points" && !servicePoint?.id) {
    return NextResponse.json(
      { error: "Point relais obligatoire." },
      { status: 400 },
    );
  }
  const shouldStoreServicePoint =
    shippingOption?.shipping_type === "service_points";
  const subtotalCents = items.reduce((total, item) => {
    const product = productMap.get(Number(item.product_id));
    if (!product) {
      return total;
    }
    return total + product.price_cents * item.qty;
  }, 0);

  let discount: DiscountCode | null = null;
  let discountCents = 0;
  if (discountCode) {
    discount = await DiscountCode.findOne({
      where: { code: discountCode, active: true },
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

  const order = await sequelize.transaction(async (transaction) => {
    const publicId = generatePublicId();

    const customer = await upsertCustomer(
      {
        email,
        firstName,
        lastName,
        phone,
        address1,
        address2,
        postalCode,
        city,
        country,
      },
      { transaction },
    );

    const insertedOrder = await Order.create(
      {
        public_id: publicId,
        status: "pending_payment",
        payment_status: "unpaid",
        refunded_cents: 0,
        customer_id: customer.id,
        preferred_payment_method: preferredPaymentMethod,
        subtotal_cents: subtotalCents,
        shipping_cents: shippingCents,
        shipping_carrier_id: shippingOption?.id ?? null,
        shipping_option_title: shippingOption?.title ?? null,
        shipping_option_carrier: shippingOption?.carrier ?? null,
        shipping_option_type: shippingOption?.shipping_type ?? null,
        service_point_id: shouldStoreServicePoint ? servicePoint?.id ?? null : null,
        service_point_name: shouldStoreServicePoint
          ? servicePoint?.name ?? null
          : null,
        service_point_street: shouldStoreServicePoint
          ? servicePoint?.street ?? null
          : null,
        service_point_house_number: shouldStoreServicePoint
          ? servicePoint?.house_number ?? null
          : null,
        service_point_postal_code: shouldStoreServicePoint
          ? servicePoint?.postal_code ?? null
          : null,
        service_point_city: shouldStoreServicePoint
          ? servicePoint?.city ?? null
          : null,
        service_point_distance: shouldStoreServicePoint
          ? servicePoint?.distance ?? null
          : null,
        discount_code_id: discount ? discount.id : null,
        discount_cents: discountCents || null,
        total_cents: totalCents,
      },
      { transaction },
    );

    const itemsPayload = items.map((item) => {
      const product = productMap.get(Number(item.product_id));
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
    const product = productMap.get(Number(item.product_id));
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
    order: {
      public_id: order.public_id,
      status: order.status,
      subtotal_cents: order.subtotal_cents,
      shipping_cents: order.shipping_cents,
      discount_cents: order.discount_cents ?? 0,
      total_cents: order.total_cents,
      created_at: order.created_at,
    },
    email_sent: !emailSkipped,
  });
}
