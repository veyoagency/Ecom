import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import AdminShell from "@/app/admin/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import OrderTagsClient from "@/app/admin/orders/[publicId]/OrderTagsClient";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-config";
import { Order, OrderItem, OrderTag, ProductImage } from "@/lib/models";
import OrderRiskCard from "@/app/admin/orders/[publicId]/OrderRiskCard";
import {
  ChevronDown,
  Copy,
  FileText,
  MoreHorizontal,
  Printer,
  Store,
  Tag,
  Truck,
} from "lucide-react";

export const metadata = {
  title: "Order",
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatOrderNumber(orderNumber: number | null, id: number) {
  if (orderNumber && Number.isFinite(orderNumber)) {
    return `#${orderNumber}`;
  }
  return `#${1000 + id}`;
}

function formatLongDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getPaymentStatus(status: string) {
  if (status === "paid" || status === "fulfilled") {
    return { label: "Paid", variant: "muted" as const, dot: "bg-neutral-400" };
  }
  return { label: "Unpaid", variant: "outline" as const, dot: "bg-amber-500" };
}

function getFulfillmentStatus(status: string) {
  if (status === "fulfilled") {
    return { label: "Fulfilled", className: "bg-emerald-100 text-emerald-800" };
  }
  return { label: "Unfulfilled", className: "bg-amber-100 text-amber-900" };
}

function getPaymentMethodBadge(method: string | null | undefined) {
  if (!method) return null;
  const normalized = method.toLowerCase();
  if (normalized.includes("paypal")) return "paypal";
  if (normalized.includes("apple")) return "apple";
  if (normalized.includes("stripe")) return "stripe";
  if (
    normalized.includes("card") ||
    normalized.includes("cb") ||
    normalized.includes("credit")
  ) {
    return "card";
  }
  return null;
}

type StripeRiskDetails = {
  score: number | null;
  level: string | null;
  sellerMessage: string | null;
  reason: string | null;
  rule: string | null;
  outcomeType: string | null;
  networkStatus: string | null;
  chargeId: string | null;
  paymentIntentId: string | null;
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const resolvedParams = await params;
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    redirect("/admin/login");
  }

  const email = session.user.email?.toLowerCase();
  if (!isAdminEmail(email)) {
    redirect("/admin/login");
  }

  const order = await Order.findOne({
    where: { public_id: resolvedParams.publicId },
    include: [
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
  });

  if (!order) {
    redirect("/admin/orders");
  }

  const orderData = order.toJSON() as Record<string, unknown>;
  const orderItems = (orderData.items as Array<Record<string, unknown>>) ?? [];
  const productIds = orderItems
    .map((item) => Number(item.product_id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const [images, availableTags, assignedTags] = await Promise.all([
    productIds.length
      ? ProductImage.findAll({
          where: { product_id: productIds },
          order: [["position", "ASC"]],
        })
      : Promise.resolve([]),
    OrderTag.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    }),
    OrderTag.findAll({
      attributes: ["id", "name"],
      include: [
        {
          model: Order,
          as: "orders",
          where: { id: order.id },
          attributes: [],
          through: { attributes: [] },
        },
      ],
      order: [["name", "ASC"]],
    }),
  ]);
  const imageMap = new Map<number, string>();
  images.forEach((image) => {
    const productId = Number(image.product_id);
    if (!Number.isFinite(productId)) return;
    if (!imageMap.has(productId)) {
      imageMap.set(productId, image.url);
    }
  });

  const payment = getPaymentStatus(order.status);
  const fulfillment = getFulfillmentStatus(order.status);
  const paymentMethodKey = getPaymentMethodBadge(
    order.preferred_payment_method,
  );
  const orderNumber = formatOrderNumber(
    orderData.order_number ? Number(orderData.order_number) : null,
    order.id,
  );

  const itemsSubtotal = orderItems.reduce((total, item) => {
    const price = Number(item.unit_price_cents_snapshot ?? 0);
    const qty = Number(item.qty ?? 0);
    return total + price * qty;
  }, 0);

  const shippingCents = Number(order.shipping_cents ?? 0);
  const discountCents = Number(order.discount_cents ?? 0);
  const paymentMethod = order.preferred_payment_method?.toLowerCase() ?? "";
  const isStripePayment = paymentMethod.includes("stripe");
  const stripeRisk: StripeRiskDetails | null = isStripePayment
    ? {
        score:
          typeof order.stripe_risk_score === "number"
            ? order.stripe_risk_score
            : null,
        level: order.stripe_risk_level ?? null,
        sellerMessage: order.stripe_seller_message ?? null,
        reason: order.stripe_risk_reason ?? null,
        rule: order.stripe_risk_rule ?? null,
        outcomeType: order.stripe_outcome_type ?? null,
        networkStatus: order.stripe_network_status ?? null,
        chargeId: order.stripe_charge_id ?? null,
        paymentIntentId: order.stripe_payment_intent_id ?? null,
      }
    : null;

  const actionButtons = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm">
        Refund
      </Button>
      <Button variant="outline" size="sm">
        Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            Print
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Print invoice</DropdownMenuItem>
          <DropdownMenuItem>Print packing slip</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <MoreHorizontal className="h-4 w-4" />
            More actions
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Duplicate order</DropdownMenuItem>
          <DropdownMenuItem>Archive</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const titleNode = (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Order {orderNumber}
        </h1>
        <Badge variant={payment.variant} className="gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${payment.dot}`} />
          {payment.label}
        </Badge>
        <Badge variant="secondary" className={fulfillment.className}>
          {fulfillment.label}
        </Badge>
      </div>
      <p className="text-xs text-neutral-500">
        {formatLongDate(order.created_at)} · from Online Store
      </p>
    </div>
  );

  return (
    <AdminShell
      title={`Order ${orderNumber}`}
      titleNode={titleNode}
      current="orders"
      action={actionButtons}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,0.2fr)]">
        <div className="space-y-6">

          <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary" className={fulfillment.className}>
                {fulfillment.label}
              </Badge>
              <Badge variant="outline" className="text-neutral-500">
                <Tag className="h-3 w-3" />
                Awaiting shipment
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm">
                <Truck className="h-4 w-4 text-neutral-500" />
                Livraison Mondial Relay
              </div>
              <div className="space-y-3">
                {orderItems.map((item) => {
                  const productId = Number(item.product_id);
                  const imageUrl = imageMap.get(productId) ?? null;
                  const qty = Number(item.qty ?? 0);
                  const unitPrice = Number(item.unit_price_cents_snapshot ?? 0);
                  return (
                    <div
                      key={item.id as number}
                      className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden border border-neutral-200 bg-neutral-100">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={String(item.title_snapshot ?? "Product")}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="text-sm">
                          <p>{item.title_snapshot as string}</p>
                          <p className="text-xs text-neutral-500">L / Noir</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>{formatCurrency(unitPrice)} x 
                          <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-xs">
                            {qty}
                          </span>
                        </span>
                        <span>{formatCurrency(unitPrice * qty)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      Mark as fulfilled
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem>Mark fulfilled</DropdownMenuItem>
                    <DropdownMenuItem>Mark unfulfilled</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button size="sm" className="bg-neutral-900 text-white hover:bg-neutral-800">
                  Create shipping label
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="muted">Paid</Badge>
              {paymentMethodKey ? (
                <Badge variant="outline" className="border-0 flex items-center gap-2 text-neutral-700">
                  {paymentMethodKey === "paypal" ? (
                    <>
                      <img
                        src="/img/paypal.svg"
                        alt="PayPal"
                        className="h-10 w-auto"
                      />
                      <span className="sr-only">PayPal</span>
                    </>
                  ) : paymentMethodKey === "apple" ? (
                    <>
                      <img
                        src="/img/apple-pay.svg"
                        alt="Apple Pay"
                        className="h-10 w-auto"
                      />
                      <span className="sr-only">Apple Pay</span>
                    </>
                  ) : paymentMethodKey === "stripe" ? (
                    <>
                      <img
                        src="/img/stripe.svg"
                        alt="Stripe"
                        className="h-9 w-auto"
                      />
                      <span className="sr-only">Stripe</span>
                    </>
                  ) : (
                    <>
                      <img
                        src="/img/credit-card.svg"
                        alt="Card"
                        className="h-10 w-auto"
                      />
                      <span className="sr-only">Card</span>
                    </>
                  )}
                </Badge>
              ) : null}
            </div>
            <div className="mt-4 space-y-3 text-sm text-neutral-600">
              <div className="grid grid-cols-3 items-center text-sm">
                <span className="text-neutral-600">Subtotal</span>
                <span className="text-left text-neutral-500">
                  {orderItems.length} {orderItems.length === 1 ? "item" : "items"}
                </span>
                <span className="text-right">{formatCurrency(itemsSubtotal)}</span>
              </div>
              <div className="grid grid-cols-3 items-center text-sm">
                <span className="text-neutral-600">Shipping</span>
                <span className="text-left text-neutral-500">Shipping method</span>
                <span className="text-right">{formatCurrency(shippingCents)}</span>
              </div>
              {discountCents > 0 ? (
                <div className="flex items-center justify-between">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountCents)}</span>
                </div>
              ) : null}
              <Separator />
              <div className="flex items-center justify-between font-medium text-neutral-900">
                <span>Total</span>
                <span>{formatCurrency(Number(order.total_cents ?? 0))}</span>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-neutral-900">Timeline</h3>
            <div className="mt-4 space-y-4 text-sm text-neutral-600">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-medium text-teal-700">
                  VA
                </div>
                <div className="flex-1 rounded-md border border-neutral-200 px-3 py-2">
                  Leave a comment...
                </div>
                <Button size="sm" variant="outline" disabled>
                  Post
                </Button>
              </div>
              <div className="space-y-3 border-l border-neutral-200 pl-4 text-xs text-neutral-500">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-neutral-400" />
                  <div>
                    <p className="text-sm text-neutral-700">
                      Order confirmation email was sent to {order.email}.
                    </p>
                    <p>{formatLongDate(order.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-neutral-400" />
                  <div>
                    <p className="text-sm text-neutral-700">
                      A {formatCurrency(Number(order.total_cents ?? 0))} payment was
                      processed.
                    </p>
                    <p>{formatLongDate(order.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-neutral-400" />
                  <div>
                    <p className="text-sm text-neutral-700">
                      {order.first_name} {order.last_name} placed this order.
                    </p>
                    <p>{formatLongDate(order.created_at)}</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-neutral-400">
                Only you and other staff can see comments.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-900">Customer</h3>
              <Button variant="ghost" size="icon">
                <Copy className="h-4 w-4 text-neutral-500" />
              </Button>
            </div>
            <div className="mt-3 space-y-3 text-sm text-neutral-600">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {order.first_name} {order.last_name}
                </p>
                <p className="text-xs text-neutral-500">1 order</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Contact information</p>
                <p className="text-sm text-blue-600">{order.email}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Shipping address</p>
                <p className="text-sm">
                  {order.first_name} {order.last_name}
                </p>
                <p className="text-sm">{order.address1}</p>
                {order.address2 ? <p className="text-sm">{order.address2}</p> : null}
                <p className="text-sm">
                  {order.postal_code} {order.city}
                </p>
                <p className="text-sm">{order.country}</p>
                <Link href="#" className="text-sm text-blue-600">
                  View map
                </Link>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Billing address</p>
                <p className="text-sm text-neutral-600">
                  Same as shipping address
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-neutral-900">
              Conversion summary
            </h3>
            <div className="mt-3 space-y-2 text-xs text-neutral-500">
              <div className="flex items-center gap-2">
                <Store className="h-3.5 w-3.5" />
                <span>1st session from Online Store</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                <span>2 sessions over 1 day</span>
              </div>
              <Link href="#" className="text-xs text-blue-600">
                View conversion details
              </Link>
            </div>
          </div>
          {stripeRisk ? <OrderRiskCard risk={stripeRisk} /> : null}

          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-neutral-900">Tags</h3>
            <div className="mt-3">
              <OrderTagsClient
                orderPublicId={order.public_id}
                initialTags={assignedTags.map((tag) => ({
                  id: tag.id,
                  name: tag.name,
                }))}
                availableTags={availableTags.map((tag) => ({
                  id: tag.id,
                  name: tag.name,
                }))}
              />
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
