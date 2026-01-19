import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { encryptSecret } from "@/lib/encryption";
import { WebsiteSetting, sequelize } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const settings = await WebsiteSetting.findOne();

  if (!settings) {
    return NextResponse.json({ settings: null });
  }

  const data = settings.toJSON() as Record<string, unknown>;
  delete data.brevo_api_key_encrypted;
  delete data.stripe_publishable_key_encrypted;
  delete data.stripe_secret_key_encrypted;
  delete data.paypal_client_id_encrypted;
  delete data.paypal_client_secret_encrypted;
  delete data.sendcloud_public_key_encrypted;
  delete data.sendcloud_private_key_encrypted;

  return NextResponse.json({ settings: data });
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const body = await request.json().catch(() => null);
  const storeName = body?.storeName?.toString().trim() ?? "";
  const domain = body?.domain?.toString().trim() ?? "";
  const websiteTitle = body?.websiteTitle?.toString().trim() ?? "";
  const websiteDescription = body?.websiteDescription?.toString().trim() ?? "";
  const defaultCurrency = body?.defaultCurrency?.toString().trim() ?? "";
  const brevoApiKey = body?.brevoApiKey?.toString().trim() ?? "";
  const stripePublishableKey = body?.stripePublishableKey?.toString().trim() ?? "";
  const stripeSecretKey = body?.stripeSecretKey?.toString().trim() ?? "";
  const paypalClientId = body?.paypalClientId?.toString().trim() ?? "";
  const paypalClientSecret = body?.paypalClientSecret?.toString().trim() ?? "";
  const sendcloudPublicKey = body?.sendcloudPublicKey?.toString().trim() ?? "";
  const sendcloudPrivateKey = body?.sendcloudPrivateKey?.toString().trim() ?? "";

  if (!storeName) {
    return NextResponse.json(
      { error: "Store name is required." },
      { status: 400 },
    );
  }

  if (!defaultCurrency) {
    return NextResponse.json(
      { error: "Default currency is required." },
      { status: 400 },
    );
  }

  const settingsPayload: Record<string, string | null> = {
    store_name: storeName,
    domain: domain || null,
    website_title: websiteTitle || null,
    website_description: websiteDescription || null,
    default_currency: defaultCurrency,
  };

  try {
    if (stripePublishableKey) {
      settingsPayload.stripe_publishable_key_encrypted = encryptSecret(
        stripePublishableKey,
      );
      settingsPayload.stripe_publishable_key_hint =
        stripePublishableKey.slice(0, 10);
    }

    if (stripeSecretKey) {
      settingsPayload.stripe_secret_key_encrypted = encryptSecret(stripeSecretKey);
      settingsPayload.stripe_secret_key_hint = stripeSecretKey.slice(0, 10);
    }

    if (brevoApiKey) {
      settingsPayload.brevo_api_key_encrypted = encryptSecret(brevoApiKey);
      settingsPayload.brevo_api_key_hint = brevoApiKey.slice(0, 10);
    }

    if (paypalClientId) {
      settingsPayload.paypal_client_id_encrypted = encryptSecret(paypalClientId);
      settingsPayload.paypal_client_id_hint = paypalClientId.slice(0, 10);
    }

    if (paypalClientSecret) {
      settingsPayload.paypal_client_secret_encrypted = encryptSecret(
        paypalClientSecret,
      );
      settingsPayload.paypal_client_secret_hint = paypalClientSecret.slice(0, 10);
    }

    if (sendcloudPublicKey) {
      settingsPayload.sendcloud_public_key_encrypted = encryptSecret(
        sendcloudPublicKey,
      );
      settingsPayload.sendcloud_public_key_hint = sendcloudPublicKey.slice(0, 10);
    }

    if (sendcloudPrivateKey) {
      settingsPayload.sendcloud_private_key_encrypted = encryptSecret(
        sendcloudPrivateKey,
      );
      settingsPayload.sendcloud_private_key_hint = sendcloudPrivateKey.slice(0, 10);
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to encrypt settings.",
      },
      { status: 500 },
    );
  }

  try {
    const updated = await sequelize.transaction(async (transaction) => {
      const existing = await WebsiteSetting.findOne({ transaction });
      if (existing) {
        await existing.update(
          settingsPayload,
          { transaction },
        );
        return existing;
      }
      return WebsiteSetting.create(
        settingsPayload,
        { transaction },
      );
    });

    const data = updated.toJSON() as Record<string, unknown>;
    delete data.brevo_api_key_encrypted;
    delete data.stripe_publishable_key_encrypted;
    delete data.stripe_secret_key_encrypted;
    delete data.paypal_client_id_encrypted;
    delete data.paypal_client_secret_encrypted;
    delete data.sendcloud_public_key_encrypted;
    delete data.sendcloud_private_key_encrypted;

    return NextResponse.json({ settings: data }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to update settings." },
      { status: 500 },
    );
  }
}
