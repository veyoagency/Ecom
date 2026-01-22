import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import AdminShell from "@/app/admin/components/AdminShell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-config";
import { Customer, Order, OrderItem, ProductImage } from "@/lib/models";

export const metadata = {
  title: "Customer",
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatCustomerName(customer: Customer) {
  const fullName = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
  return fullName || customer.email || "Client";
}

function formatOrderNumber(orderNumber: number | null, id: number) {
  if (orderNumber && Number.isFinite(orderNumber)) {
    return `#${orderNumber}`;
  }
  return `#${1000 + id}`;
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function calculateDaysSince(date: Date) {
  const start = new Date(date).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - start);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const customerId = Number(resolvedParams.id);

  if (!Number.isFinite(customerId) || customerId <= 0) {
    redirect("/admin/customers");
  }

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    redirect("/admin/login");
  }

  const email = session.user.email?.toLowerCase();
  if (!isAdminEmail(email)) {
    redirect("/admin/login");
  }

  const customer = await Customer.findByPk(customerId);
  if (!customer) {
    redirect("/admin/customers");
  }

  const orders = await Order.findAll({
    where: { customer_id: customerId },
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
    order: [
      ["created_at", "DESC"],
      [{ model: OrderItem, as: "items" }, "id", "ASC"],
    ],
  });

  const totalOrders = orders.length;
  const productIds = orders
    .flatMap((order) => {
      const orderData = order.toJSON() as Record<string, unknown>;
      const items = (orderData.items as Array<Record<string, unknown>>) ?? [];
      return items.map((item) => Number(item.product_id)).filter((id) => id > 0);
    })
    .filter((value, index, self) => self.indexOf(value) === index);
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
  const amountSpentCents = orders.reduce((total, order) => {
    if (order.status === "paid" || order.status === "fulfilled") {
      return total + Number(order.total_cents ?? 0);
    }
    return total;
  }, 0);
  const customerSinceDays = calculateDaysSince(customer.created_at);
  const customerAddressLines = [
    customer.address1,
    customer.address2,
    `${customer.postal_code ?? ""} ${customer.city ?? ""}`.trim(),
    customer.country,
  ].filter(Boolean);
  return (
    <AdminShell
      title={formatCustomerName(customer)}
      current="customers"
      titleNode={
        <div>
          <div className="text-sm text-neutral-500">Customer</div>
          <div className="text-2xl font-semibold text-neutral-900">
            {formatCustomerName(customer)}
          </div>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>Customer performance at a glance.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase text-neutral-400">Total spent</p>
                  <p className="text-lg font-semibold text-neutral-900">
                    {formatCurrency(amountSpentCents)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-neutral-400">Orders</p>
                  <p className="text-lg font-semibold text-neutral-900">
                    {totalOrders}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-neutral-400">
                    Customer since
                  </p>
                  <p className="text-lg font-semibold text-neutral-900">
                    {customerSinceDays} day{customerSinceDays === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Orders</CardTitle>
              <CardDescription>All orders linked to this customer.</CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length ? (
                <div className="space-y-6">
                  {orders.map((order) => {
                    const orderData = order.toJSON() as Record<string, unknown>;
                    const items = (orderData.items as Array<Record<string, unknown>>) ?? [];
                    const subtotalCents = Number(order.subtotal_cents ?? 0);
                    const shippingCents = Number(order.shipping_cents ?? 0);
                    const shippingTitle =
                      typeof order.shipping_option_title === "string"
                        ? order.shipping_option_title.trim()
                        : "";
                    const discountCents = Number(order.discount_cents ?? 0);
                    const totalCents = Number(order.total_cents ?? 0);
                    return (
                      <div
                        key={order.id}
                        className="rounded-lg border border-neutral-200 bg-white p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
                          <div>
                            <Link
                              href={`/admin/orders/${order.public_id}`}
                              className="text-sm font-semibold text-neutral-900 hover:underline"
                            >
                              {formatOrderNumber(order.order_number, order.id)}
                            </Link>
                            <p className="text-xs text-neutral-500">
                              {formatShortDate(order.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-neutral-600">
                            <span className="rounded-full border border-neutral-200 px-2 py-0.5 capitalize">
                              {formatStatusLabel(order.status)}
                            </span>
                            <span>{order.preferred_payment_method}</span>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                          <div className="space-y-3">
                            {items.length ? (
                              items.map((item) => {
                                const qty = Number(item.qty ?? 0);
                                const unitPrice = Number(
                                  item.unit_price_cents_snapshot ?? 0,
                                );
                                const lineTotal = qty * unitPrice;
                                const productId = Number(item.product_id ?? 0);
                                const imageUrl = Number.isFinite(productId)
                                  ? imageMap.get(productId) ?? null
                                  : null;
                                return (
                                  <div
                                    key={String(item.id)}
                                    className="flex items-center justify-between text-sm text-neutral-700"
                                  >
                                    <div className="flex items-center gap-3 pr-4">
                                      <div className="h-10 w-10 overflow-hidden bg-neutral-100">
                                        {imageUrl ? (
                                          <img
                                            src={imageUrl}
                                            alt={String(item.title_snapshot ?? "Produit")}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : null}
                                      </div>
                                      <div>
                                      <p className="font-medium text-neutral-900">
                                        {String(item.title_snapshot ?? "Produit")}
                                      </p>
                                      <p className="text-xs text-neutral-500">
                                        {qty} x {formatCurrency(unitPrice)}
                                      </p>
                                      </div>
                                    </div>
                                    <div className="text-neutral-900">
                                      {formatCurrency(lineTotal)}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-sm text-neutral-500">
                                No items recorded.
                              </p>
                            )}
                          </div>

                          <div className="space-y-4">
                            <div className="rounded-md border border-neutral-200 p-3 text-sm text-neutral-700">
                              <div className="flex items-center justify-between">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotalCents)}</span>
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <span>Shipping</span>
                                <span>{formatCurrency(shippingCents)}</span>
                              </div>
                              {shippingTitle ? (
                                <p className="mt-1 text-xs text-neutral-500">
                                  {shippingTitle}
                                </p>
                              ) : null}
                              {discountCents > 0 ? (
                                <div className="mt-2 flex items-center justify-between">
                                  <span>Discount</span>
                                  <span>-{formatCurrency(discountCents)}</span>
                                </div>
                              ) : null}
                              <div className="mt-3 flex items-center justify-between font-semibold text-neutral-900">
                                <span>Total</span>
                                <span>{formatCurrency(totalCents)}</span>
                              </div>
                            </div>

                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
                  No orders yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Contact info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-neutral-700">
              <div>
                <p className="text-xs uppercase text-neutral-400">Name</p>
                <p>{formatCustomerName(customer)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-neutral-400">Email</p>
                <p>{customer.email}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-neutral-400">Phone</p>
                <p>{customer.phone || "-"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Address</CardTitle>
              <CardDescription>
                {customerAddressLines.length ? "Customer address." : "No address yet."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-neutral-700">
              {customerAddressLines.length ? (
                customerAddressLines.map((line) => <p key={line}>{line}</p>)
              ) : (
                <p>-</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
