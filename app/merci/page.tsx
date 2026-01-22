import Link from "next/link";
import localFont from "next/font/local";

import { CheckCircle2, MapPin } from "lucide-react";

import StorefrontCartProvider from "@/components/storefront/StorefrontCartProvider";
import StoreHeaderServer from "@/components/storefront/StoreHeaderServer";
import { Customer, Order, OrderItem, ProductImage } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

type OrderItemRecord = {
  id: number;
  product_id: number | null;
  title_snapshot: string;
  unit_price_cents_snapshot: number;
  qty: number;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams?: Promise<{ order?: string | string[] }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawOrderParam = resolvedSearchParams?.order;
  const orderPublicId =
    typeof rawOrderParam === "string"
      ? rawOrderParam.trim().toLowerCase()
      : Array.isArray(rawOrderParam)
        ? rawOrderParam[0]?.trim().toLowerCase() ?? ""
        : "";

  const order = orderPublicId
    ? await Order.findOne({
        where: { public_id: orderPublicId },
        include: [
          {
            model: Customer,
            as: "customer",
          },
          {
            model: OrderItem,
            as: "items",
            attributes: [
              "id",
              "product_id",
              "title_snapshot",
              "unit_price_cents_snapshot",
              "qty",
            ],
          },
        ],
        order: [[{ model: OrderItem, as: "items" }, "id", "ASC"]],
      })
    : null;

  if (!order) {
    return (
      <StorefrontCartProvider>
        <div className={`storefront ${futura.className} min-h-screen bg-neutral-100`}>
          <StoreHeaderServer />
          <main className="mx-auto w-full max-w-[1200px] px-4 py-10">
            <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
              <h1 className="text-2xl text-neutral-900">Commande introuvable</h1>
              <p className="mt-2 text-sm text-neutral-500">
                Nous ne trouvons pas cette commande. Verifiez le lien ou
                retournez a la boutique.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex rounded-md border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                Retour a la boutique
              </Link>
            </div>
          </main>
        </div>
      </StorefrontCartProvider>
    );
  }

  const orderData = order.toJSON() as Record<string, unknown>;
  const orderItems = (orderData.items as OrderItemRecord[]) ?? [];
  const customerData = (orderData.customer as Record<string, unknown>) ?? null;
  const customerFirstName = (customerData?.first_name as string | null) ?? "";
  const customerLastName = (customerData?.last_name as string | null) ?? "";
  const customerName = `${customerFirstName} ${customerLastName}`.trim();
  const customerEmail = (customerData?.email as string | null) ?? "";
  const customerPhone = (customerData?.phone as string | null) ?? "";
  const productIds = orderItems
    .map((item) => Number(item.product_id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const images = productIds.length
    ? await ProductImage.findAll({
        where: { product_id: productIds },
        order: [["position", "ASC"]],
      })
    : [];
  const imageMap = new Map<number, string>();
  images.forEach((image) => {
    const productId = Number(image.product_id);
    if (!Number.isFinite(productId)) return;
    if (!imageMap.has(productId)) {
      imageMap.set(productId, image.url);
    }
  });

  const fullName = customerName || "Client";
  const addressLines = [
    (customerData?.address1 as string | null) ?? "",
    (customerData?.address2 as string | null) ?? "",
    `${(customerData?.postal_code as string | null) ?? ""} ${
      (customerData?.city as string | null) ?? ""
    }`.trim(),
    (customerData?.country as string | null) ?? "",
  ].filter(Boolean);
  const contactLine = customerPhone
    ? `${customerEmail} • ${customerPhone}`
    : customerEmail;
  const paymentMethod = order.preferred_payment_method?.trim() || "Carte";
  const subtotalCents = Number(order.subtotal_cents ?? 0);
  const shippingCents = Number(order.shipping_cents ?? 0);
  const discountCents = Number(order.discount_cents ?? 0);
  const totalCents = Number(order.total_cents ?? 0);
  const shippingTitle =
    typeof order.shipping_option_title === "string"
      ? order.shipping_option_title.trim()
      : "";
  const shippingLabel = shippingTitle
    ? `${shippingTitle} - ${formatCurrency(shippingCents)}`
    : shippingCents > 0
      ? `Standard (${formatCurrency(shippingCents)})`
      : "Gratuit";

  return (
    <StorefrontCartProvider>
      <div className={`storefront ${futura.className} min-h-screen bg-neutral-100`}>
        <StoreHeaderServer />
        <main className="mx-auto w-full max-w-[1200px] px-4 py-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <div>
                  <p className="text-xs uppercase text-neutral-500">
                    Confirmation #{order.public_id}
                  </p>
                  <h1 className="text-2xl text-neutral-900">
                    Merci, {customerFirstName || "Client"} !
                  </h1>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                <div className="space-y-3 border-t border-neutral-200 bg-white px-6 py-5 text-sm">
                  <p className="font-medium text-neutral-900">
                    Votre commande est confirmee
                  </p>
                  <p className="text-neutral-500">
                    Vous recevrez un email de confirmation avec votre numero de commande.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-medium text-neutral-900">
                  Details de commande
                </h2>
                <div className="mt-4 grid gap-6 text-sm text-neutral-600 sm:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs uppercase text-neutral-400">
                        Contact
                      </p>
                      <p>{contactLine}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-neutral-400">
                        Adresse de livraison
                      </p>
                      <p>{fullName}</p>
                      {addressLines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs uppercase text-neutral-400">
                        Mode d&apos;expedition
                      </p>
                      <p>{shippingLabel}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs uppercase text-neutral-400">
                        Mode de paiement
                      </p>
                      <p>
                        {paymentMethod} - {formatCurrency(totalCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-neutral-400">
                        Adresse de facturation
                      </p>
                      <p>{fullName}</p>
                      {addressLines.map((line) => (
                        <p key={`billing-${line}`}>{line}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="space-y-4">
                  {orderItems.length ? (
                    orderItems.map((item) => {
                      const productId = Number(item.product_id);
                      const imageUrl = Number.isFinite(productId)
                        ? imageMap.get(productId) ?? null
                        : null;
                      const unitPrice = Number(item.unit_price_cents_snapshot ?? 0);
                      const qty = Number(item.qty ?? 0);
                      const lineTotal = unitPrice * qty;

                      return (
                        <div key={item.id} className="flex items-start gap-4">
                          <div className="relative h-14 w-14 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={item.title_snapshot}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="flex-1 text-sm text-neutral-700">
                            <p>{item.title_snapshot}</p>
                            <p className="text-xs text-neutral-500">
                              {qty} x {formatCurrency(unitPrice)}
                            </p>
                          </div>
                          <div className="text-sm text-neutral-700">
                            {formatCurrency(lineTotal)}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-neutral-500">
                      Aucun article dans la commande.
                    </p>
                  )}
                </div>
                <div className="mt-6 space-y-2 border-t border-neutral-200 pt-4 text-sm text-neutral-600">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotalCents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Shipping</span>
                    <span>{formatCurrency(shippingCents)}</span>
                  </div>
                  {discountCents > 0 ? (
                    <div className="flex items-center justify-between">
                      <span>Discount</span>
                      <span>-{formatCurrency(discountCents)}</span>
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between text-base font-medium text-neutral-900">
                    <span>Total</span>
                    <span>{formatCurrency(totalCents)}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </StorefrontCartProvider>
  );
}
