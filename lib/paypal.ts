import { decryptSecret } from "@/lib/encryption";
import { WebsiteSetting } from "@/lib/models";

type PayPalEnv = "sandbox" | "live";

function getPayPalEnv(): PayPalEnv {
  const raw = process.env.PAYPAL_ENV?.toLowerCase();
  if (raw === "live" || raw === "production") {
    return "live";
  }
  return "sandbox";
}

export function getPayPalBaseUrl() {
  const env = getPayPalEnv();
  return env === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function normalizeKey(value: string | null | undefined) {
  return value?.trim() || "";
}

export async function getPayPalClientId() {
  const settings = await WebsiteSetting.findOne();
  const encrypted = normalizeKey(settings?.paypal_client_id_encrypted);
  if (encrypted) {
    return decryptSecret(encrypted);
  }

  return (
    process.env.PAYPAL_CLIENT_ID ??
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ??
    ""
  );
}

export async function getPayPalClientSecret() {
  const settings = await WebsiteSetting.findOne();
  const encrypted = normalizeKey(settings?.paypal_client_secret_encrypted);
  if (encrypted) {
    return decryptSecret(encrypted);
  }

  return process.env.PAYPAL_CLIENT_SECRET ?? "";
}

export async function getPayPalAccessToken() {
  const clientId = await getPayPalClientId();
  const clientSecret = await getPayPalClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Missing PayPal API credentials.");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = (await response.json()) as { access_token?: string };
  if (!response.ok || !data.access_token) {
    throw new Error("Unable to get PayPal access token.");
  }

  return data.access_token;
}
