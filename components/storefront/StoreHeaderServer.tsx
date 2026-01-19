import StoreHeader from "@/components/storefront/StoreHeader";
import { WebsiteSetting } from "@/lib/models";
import { getPayPalClientId } from "@/lib/paypal";

type StoreHeaderServerProps = {
  transparent?: boolean;
  fontClassName?: string;
  logoVariant?: "default" | "transparent";
};

export default async function StoreHeaderServer({
  transparent = false,
  fontClassName = "",
  logoVariant = "default",
}: StoreHeaderServerProps) {
  let storeName = "New Commerce";
  let logoUrl: string | null = null;
  let paypalClientId = "";

  try {
    const settings = await WebsiteSetting.findOne();
    if (settings?.store_name?.trim()) {
      storeName = settings.store_name.trim();
    }
    logoUrl =
      logoVariant === "transparent"
        ? settings?.logo_transparent_url ?? null
        : settings?.logo_url ?? null;
    paypalClientId = await getPayPalClientId();
  } catch {
    // Keep fallback values on DB errors.
  }

  return (
    <StoreHeader
      transparent={transparent}
      fontClassName={fontClassName}
      storeName={storeName}
      logoUrl={logoUrl}
      paypalClientId={paypalClientId || undefined}
    />
  );
}
