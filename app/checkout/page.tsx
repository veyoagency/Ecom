import localFont from "next/font/local";

import StorefrontCartProvider from "@/components/storefront/StorefrontCartProvider";
import { decryptSecret } from "@/lib/encryption";
import { WebsiteSetting } from "@/lib/models";
import { getStripePublishableKey } from "@/lib/stripe";
import CheckoutClient from "@/app/checkout/CheckoutClient";
import { DEFAULT_COUNTRY } from "@/lib/constants";

const futura = localFont({
  src: [
    {
      path: "../../public/fonts/FuturaPT-Book.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/FuturaPT-Book.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/FuturaPT-Book.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
});

export default async function CheckoutPage() {
  const settings = await WebsiteSetting.findOne();
  const storeName = settings?.store_name?.trim() || "New Commerce";
  const logoUrl = settings?.logo_url ?? null;
  const shippingCents = Number(process.env.SHIPPING_CENTS ?? 0) || 0;
  let stripePublishableKey = "";
  try {
    stripePublishableKey = await getStripePublishableKey();
  } catch {
    stripePublishableKey = "";
  }
  let googleMapsApiKey = "";
  if (settings?.google_maps_api_key_encrypted) {
    try {
      googleMapsApiKey = decryptSecret(settings.google_maps_api_key_encrypted);
    } catch {
      googleMapsApiKey = "";
    }
  }
  let googleMapsCountryCodes: string[] = [];
  if (settings?.google_maps_country_codes) {
    try {
      const parsed = JSON.parse(settings.google_maps_country_codes);
      if (Array.isArray(parsed)) {
        googleMapsCountryCodes = parsed
          .map((code) => code?.toString().trim().toUpperCase())
          .filter((code) => code);
      }
    } catch {
      googleMapsCountryCodes = [];
    }
  }

  return (
    <StorefrontCartProvider>
      <CheckoutClient
        fontClassName={futura.className}
        storeName={storeName}
        logoUrl={logoUrl}
        shippingCents={Number.isFinite(shippingCents) ? shippingCents : 0}
        stripePublishableKey={stripePublishableKey || null}
        googleMapsApiKey={googleMapsApiKey || null}
        checkoutCountryCodes={
          googleMapsCountryCodes.length ? googleMapsCountryCodes : [DEFAULT_COUNTRY]
        }
      />
    </StorefrontCartProvider>
  );
}
