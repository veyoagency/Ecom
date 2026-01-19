import { NextResponse } from "next/server";

import { getStripeClient } from "@/lib/stripe";
import {
  getOptionalTrimmedString,
  getTrimmedString,
  isValidEmail,
} from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdatePayload = {
  paymentIntentId: string;
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: {
      line1?: string | null;
      line2?: string | null;
      postal_code?: string | null;
      city?: string | null;
      country?: string | null;
    } | null;
  };
  shipping?: {
    name?: string | null;
    phone?: string | null;
    address?: {
      line1?: string | null;
      line2?: string | null;
      postal_code?: string | null;
      city?: string | null;
      country?: string | null;
    } | null;
  };
  checkoutUrl?: string | null;
};

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  let payload: UpdatePayload | null = null;
  try {
    payload = (await request.json()) as UpdatePayload;
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400 },
    );
  }

  const paymentIntentId = getTrimmedString(payload?.paymentIntentId);
  if (!paymentIntentId) {
    return NextResponse.json(
      { error: "PaymentIntent manquant." },
      { status: 400 },
    );
  }

  const customer = payload?.customer ?? null;
  const shipping = payload?.shipping ?? null;
  const email = getOptionalTrimmedString(customer?.email)?.toLowerCase() ?? null;
  const name = getOptionalTrimmedString(customer?.name) ?? null;
  const phone = getOptionalTrimmedString(customer?.phone) ?? null;
  const checkoutUrl = getOptionalTrimmedString(payload?.checkoutUrl) ?? null;

  const billingAddress = customer?.address ?? null;
  const shippingAddress = shipping?.address ?? null;

  const userAgent = request.headers.get("user-agent");
  const clientIp = getClientIp(request);

  try {
    const stripe = await getStripeClient();
    let customerId: string | null = null;

    if (email && isValidEmail(email)) {
      const existing = await stripe.customers.list({ email, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
        await stripe.customers.update(customerId, {
          name: name || undefined,
          email,
          phone: phone || undefined,
          address: billingAddress
            ? {
                line1: billingAddress.line1 || undefined,
                line2: billingAddress.line2 || undefined,
                postal_code: billingAddress.postal_code || undefined,
                city: billingAddress.city || undefined,
                country: billingAddress.country || undefined,
              }
            : undefined,
          shipping: shipping
            ? {
                name: shipping.name || name || undefined,
                phone: shipping.phone || phone || undefined,
                address: shippingAddress
                  ? {
                      line1: shippingAddress.line1 || undefined,
                      line2: shippingAddress.line2 || undefined,
                      postal_code: shippingAddress.postal_code || undefined,
                      city: shippingAddress.city || undefined,
                      country: shippingAddress.country || undefined,
                    }
                  : undefined,
              }
            : undefined,
        });
      } else {
        const created = await stripe.customers.create({
          name: name || undefined,
          email,
          phone: phone || undefined,
          address: billingAddress
            ? {
                line1: billingAddress.line1 || undefined,
                line2: billingAddress.line2 || undefined,
                postal_code: billingAddress.postal_code || undefined,
                city: billingAddress.city || undefined,
                country: billingAddress.country || undefined,
              }
            : undefined,
          shipping: shipping
            ? {
                name: shipping.name || name || undefined,
                phone: shipping.phone || phone || undefined,
                address: shippingAddress
                  ? {
                      line1: shippingAddress.line1 || undefined,
                      line2: shippingAddress.line2 || undefined,
                      postal_code: shippingAddress.postal_code || undefined,
                      city: shippingAddress.city || undefined,
                      country: shippingAddress.country || undefined,
                    }
                  : undefined,
              }
            : undefined,
        });
        customerId = created.id;
      }
    }

    await stripe.paymentIntents.update(paymentIntentId, {
      customer: customerId || undefined,
      receipt_email: email || undefined,
      shipping: shipping
        ? {
            name: shipping.name || name || undefined,
            phone: shipping.phone || phone || undefined,
            address: shippingAddress
              ? {
                  line1: shippingAddress.line1 || undefined,
                  line2: shippingAddress.line2 || undefined,
                  postal_code: shippingAddress.postal_code || undefined,
                  city: shippingAddress.city || undefined,
                  country: shippingAddress.country || undefined,
                }
              : undefined,
          }
        : undefined,
      metadata: {
        client_ip: clientIp || "",
        user_agent: userAgent || "",
        checkout_url: checkoutUrl || "",
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Erreur Stripe." },
      { status: 502 },
    );
  }
}
