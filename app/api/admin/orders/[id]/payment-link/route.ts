import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import { Order } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const id = parseId(context.params.id);
  if (!id) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Donnees invalides." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const link =
    (typeof record.paypal_link === "string" && record.paypal_link.trim()) ||
    (typeof record.payment_link === "string" && record.payment_link.trim());

  if (!link) {
    return NextResponse.json({ error: "Lien PayPal manquant." }, { status: 400 });
  }

  const order = await Order.findByPk(id, {
    attributes: ["id", "public_id", "first_name", "email"],
  });
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  const text = `Bonjour ${order.first_name},\n\nVoici votre lien PayPal pour regler la commande ${order.public_id}:\n${link}\n\nMerci.`;
  const html = `
    <p>Bonjour ${order.first_name},</p>
    <p>Voici votre lien PayPal pour regler la commande <strong>${order.public_id}</strong>:</p>
    <p><a href="${link}">${link}</a></p>
    <p>Merci.</p>
  `;

  let emailSkipped = false;
  try {
    const result = await sendEmail({
      to: order.email,
      subject: `Lien PayPal pour la commande ${order.public_id}`,
      text,
      html,
    });
    emailSkipped = result.skipped;
  } catch {
    emailSkipped = true;
  }

  order.status = "payment_link_sent";
  await order.save();

  return NextResponse.json({
    ok: true,
    email_sent: !emailSkipped,
  });
}
