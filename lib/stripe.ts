import Stripe from "stripe";

import { decryptSecret } from "@/lib/encryption";
import { WebsiteSetting } from "@/lib/models";

let stripeClient: Stripe | null = null;
let stripeClientKey: string | null = null;

function normalizeKey(value: string | null | undefined) {
  return value?.trim() || "";
}

export async function getStripePublishableKey() {
  const settings = await WebsiteSetting.findOne();
  const encrypted = normalizeKey(settings?.stripe_publishable_key_encrypted);
  if (encrypted) {
    return decryptSecret(encrypted);
  }

  return normalizeKey(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

async function getStripeSecretKey() {
  const settings = await WebsiteSetting.findOne();
  const encrypted = normalizeKey(settings?.stripe_secret_key_encrypted);
  if (encrypted) {
    return decryptSecret(encrypted);
  }

  return normalizeKey(process.env.STRIPE_SECRET_KEY);
}

export async function getStripeClient() {
  const secretKey = await getStripeSecretKey();
  if (!secretKey) {
    throw new Error("Missing Stripe secret key.");
  }

  if (!stripeClient || stripeClientKey !== secretKey) {
    stripeClient = new Stripe(secretKey);
    stripeClientKey = secretKey;
  }

  return stripeClient;
}
