import Link from "next/link";

type StoreFooterProps = {
  storeName?: string;
  logoUrl?: string | null;
  fontClassName?: string;
};

const MENU_COLUMNS = [
  [
    { label: "Accueil", href: "/" },
    { label: "Collections", href: "/collections" },
    { label: "Nouveautes", href: "/nouveautes" },
    { label: "Contact", href: "/contact" },
  ],
  [
    { label: "Livraison", href: "/livraison" },
    { label: "Retours", href: "/retours" },
    { label: "FAQ", href: "/faq" },
    { label: "Mentions legales", href: "/mentions-legales" },
  ],
];

export default function StoreFooter({
  storeName = "New Commerce",
  logoUrl = null,
  fontClassName = "",
}: StoreFooterProps) {
  return (
    <footer className={`bg-white py-10 ${fontClassName}`.trim()}>
      <div className="mx-auto flex max-w-[1500px] flex-col gap-8 px-4 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[auto_1fr_1fr] md:items-start">
          <div className="flex items-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={storeName}
                className="h-10 w-auto object-contain"
              />
            ) : (
              <span className="text-base font-normal text-neutral-900">
                {storeName}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-8 md:contents">
            {MENU_COLUMNS.map((column, index) => (
              <div key={`footer-col-${index}`} className="flex flex-col gap-3">
                {column.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="text-sm text-neutral-700"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-neutral-500 mt-2">
          © {new Date().getFullYear()} {storeName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
