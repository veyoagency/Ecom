import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { Order } from "@/lib/models";
import { getPayPalAccessToken, getPayPalBaseUrl } from "@/lib/paypal";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toFixedAmount(cents: number) {
  return (cents / 100).toFixed(2);
}

function parseId(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const params = await context.params;
  const id = parseId(params.id);
  if (!id) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  let payload: { amountCents?: number } | null = null;
  try {
    payload = (await request.json()) as { amountCents?: number };
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400 },
    );
  }

  const amountCents = Number(payload?.amountCents);
  if (!Number.isFinite(amountCents) || !Number.isInteger(amountCents)) {
    return NextResponse.json(
      { error: "Montant invalide." },
      { status: 400 },
    );
  }

  const order = await Order.findByPk(id);
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  if (order.status !== "paid" && order.status !== "fulfilled") {
    return NextResponse.json(
      { error: "Commande non payee." },
      { status: 400 },
    );
  }

  const totalCents = Number(order.total_cents ?? 0);
  const refundedCents = Number(order.refunded_cents ?? 0);
  const remainingCents = Math.max(totalCents - refundedCents, 0);

  if (amountCents <= 0 || amountCents > remainingCents) {
    return NextResponse.json(
      { error: "Montant de remboursement invalide." },
      { status: 400 },
    );
  }

  const paymentMethod = order.preferred_payment_method?.toLowerCase() ?? "";

  try {
    if (paymentMethod.includes("stripe")) {
      const stripe = await getStripeClient();
      const paymentIntentId = order.stripe_payment_intent_id ?? undefined;
      const chargeId = order.stripe_charge_id ?? undefined;

      if (!paymentIntentId && !chargeId) {
        return NextResponse.json(
          { error: "Paiement Stripe introuvable." },
          { status: 400 },
        );
      }

      await stripe.refunds.create({
        payment_intent: paymentIntentId,
        charge: paymentIntentId ? undefined : chargeId,
        amount: amountCents,
      });
    } else if (paymentMethod.includes("paypal")) {
      const captureId = order.paypal_capture_id;
      if (!captureId) {
        return NextResponse.json(
          { error: "Paiement PayPal introuvable." },
          { status: 400 },
        );
      }

      const accessToken = await getPayPalAccessToken();
      const response = await fetch(
        `${getPayPalBaseUrl()}/v2/payments/captures/${captureId}/refund`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: {
              value: toFixedAmount(amountCents),
              currency_code: "EUR",
            },
          }),
        },
      );

      if (!response.ok) {
        return NextResponse.json(
          { error: "Remboursement PayPal impossible." },
          { status: 502 },
        );
      }
    } else {
      return NextResponse.json(
        { error: "Methode de paiement non supportee." },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Remboursement impossible." },
      { status: 502 },
    );
  }

  const newRefundedCents = refundedCents + amountCents;
  const paymentStatus =
    newRefundedCents >= totalCents ? "refunded" : "partially_refunded";

  await order.update({
    refunded_cents: newRefundedCents,
    payment_status: paymentStatus,
  });

  return NextResponse.json({
    ok: true,
    order: {
      public_id: order.public_id,
      refunded_cents: newRefundedCents,
      payment_status: paymentStatus,
    },
  });
}
