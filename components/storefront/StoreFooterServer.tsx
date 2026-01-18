import StoreFooter from "@/components/storefront/StoreFooter";
import { WebsiteSetting } from "@/lib/models";

type StoreFooterServerProps = {
  fontClassName?: string;
};

export default async function StoreFooterServer({
  fontClassName = "",
}: StoreFooterServerProps) {
  let storeName = "New Commerce";
  let logoUrl: string | null = null;

  try {
    const settings = await WebsiteSetting.findOne();
    if (settings?.store_name?.trim()) {
      storeName = settings.store_name.trim();
    }
    logoUrl = settings?.logo_url ?? null;
  } catch {
    // Keep fallback values on DB errors.
  }

  return (
    <StoreFooter
      storeName={storeName}
      logoUrl={logoUrl}
      fontClassName={fontClassName}
    />
  );
}
