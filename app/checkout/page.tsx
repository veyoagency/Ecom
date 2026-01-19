import localFont from "next/font/local";

import StorefrontCartProvider from "@/components/storefront/StorefrontCartProvider";
import { WebsiteSetting } from "@/lib/models";
import { getStripePublishableKey } from "@/lib/stripe";
import CheckoutClient from "@/app/checkout/CheckoutClient";

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

  return (
    <StorefrontCartProvider>
      <CheckoutClient
        fontClassName={futura.className}
        storeName={storeName}
        logoUrl={logoUrl}
        shippingCents={Number.isFinite(shippingCents) ? shippingCents : 0}
        stripePublishableKey={stripePublishableKey || null}
      />
    </StorefrontCartProvider>
  );
}
