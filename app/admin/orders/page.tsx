import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sequelize } from "sequelize";

import AdminShell from "@/app/admin/components/AdminShell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-config";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import {
  Customer,
  Op,
  Order,
  OrderItem,
  OrderTag,
  OrderTagAssignment,
} from "@/lib/models";
import { Filter, Search } from "lucide-react";

export const metadata = {
  title: "Orders",
};

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

function getStringParam(value: string | string[] | undefined) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function getActionButton() {
  return (
    <Button asChild size="sm">
      <Link href="/admin/orders/new">Create order</Link>
    </Button>
  );
}

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

function formatRelativeDate(value: Date) {
  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);

  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (date >= startOfToday) {
    return `Today at ${time}`;
  }
  if (date >= startOfYesterday && date < startOfToday) {
    return `Yesterday at ${time}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatCustomerName(customer?: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  const name = `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim();
  return name || customer?.email || "Client";
}

function getPaymentStatus(status: string, paymentStatus?: string | null) {
  const normalized = paymentStatus ?? "";
  if (normalized === "refunded") {
    return { label: "Refunded", variant: "outline" as const, dot: "bg-rose-500" };
  }
  if (normalized === "partially_refunded") {
    return {
      label: "Partially refunded",
      variant: "outline" as const,
      dot: "bg-amber-500",
    };
  }
  if (normalized === "paid") {
    return { label: "Paid", variant: "muted" as const, dot: "bg-emerald-500" };
  }
  if (normalized === "unpaid") {
    return { label: "Unpaid", variant: "outline" as const, dot: "bg-amber-500" };
  }
  if (status === "paid" || status === "fulfilled") {
    return { label: "Paid", variant: "muted" as const, dot: "bg-emerald-500" };
  }
  return { label: "Unpaid", variant: "outline" as const, dot: "bg-amber-500" };
}

function getFulfillmentStatus(status: string) {
  if (status === "fulfilled") {
    return { label: "Fulfilled", className: "bg-emerald-100 text-emerald-800" };
  }
  return { label: "Unfulfilled", className: "bg-amber-100 text-amber-900" };
}

function buildPageHref(searchParams: SearchParams, page: number) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (!value || key === "page") return;
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    } else {
      params.set(key, value);
    }
  });
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/admin/orders?${query}` : "/admin/orders";
}

function buildQueryHref(
  searchParams: SearchParams,
  overrides: Record<string, string | null>,
) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (!value || key === "page") return;
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    } else {
      params.set(key, value);
    }
  });
  Object.entries(overrides).forEach(([key, value]) => {
    if (!value) {
      params.delete(key);
      return;
    }
    params.set(key, value);
  });
  const query = params.toString();
  return query ? `/admin/orders?${query}` : "/admin/orders";
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    redirect("/admin/login");
  }

  const email = session.user.email?.toLowerCase();
  if (!isAdminEmail(email)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-6">
        <Card className="w-full max-w-md border-neutral-200 bg-white">
          <CardHeader className="text-center">
            <CardDescription className="text-xs uppercase tracking-[0.3em] text-neutral-400">
              Access denied
            </CardDescription>
            <CardTitle className="text-2xl">Admin not allowed</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-neutral-500">
            Your account is not in the allowed admin email list.
          </CardContent>
        </Card>
      </div>
    );
  }

  const pageParam = getStringParam(resolvedSearchParams.page);
  const statusParam = getStringParam(resolvedSearchParams.status);
  const queryParam = getStringParam(resolvedSearchParams.query);
  const sortParam = getStringParam(resolvedSearchParams.sort);
  const orderParam = getStringParam(resolvedSearchParams.order);
  const page = Math.max(1, Number(pageParam) || 1);
  const limit = DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (statusParam === "unfulfilled") {
    where.status = { [Op.in]: ["paid"] };
  } else if (statusParam === "unpaid") {
    where.status = { [Op.in]: ["pending_payment", "payment_link_sent"] };
  } else if (statusParam === "open") {
    where.status = {
      [Op.in]: ["pending_payment", "payment_link_sent", "paid"],
    };
  } else if (statusParam === "archived") {
    where.delivery_status = "Delivered";
  }
  if (queryParam) {
    where[Op.or] = [
      { public_id: { [Op.iLike]: `%${queryParam}%` } },
      { "$customer.email$": { [Op.iLike]: `%${queryParam}%` } },
      { "$customer.first_name$": { [Op.iLike]: `%${queryParam}%` } },
      { "$customer.last_name$": { [Op.iLike]: `%${queryParam}%` } },
    ];
  }

  const sortKey =
    sortParam === "title" || sortParam === "updated" || sortParam === "created"
      ? sortParam
      : "created";
  const orderKey = orderParam === "asc" ? "ASC" : "DESC";
  const orderParamNormalized = orderKey === "ASC" ? "asc" : "desc";
  const orderColumn =
    sortKey === "title"
      ? "public_id"
      : sortKey === "updated"
        ? "updated_at"
        : "created_at";

  const [orders, total] = await Promise.all([
    Order.findAll({
      attributes: [
        "id",
        "public_id",
        "order_number",
        "status",
        "payment_status",
        "total_cents",
        "delivery_status",
        "shipping_option_title",
        "created_at",
        [Sequelize.fn("COUNT", Sequelize.col("items.id")), "items_count"],
      ],
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["first_name", "last_name", "email"],
        },
        {
          model: OrderItem,
          as: "items",
          attributes: [],
        },
      ],
      group: ["Order.id", "customer.id"],
      where,
      order: [[Sequelize.col(orderColumn), orderKey]],
      limit,
      offset,
      subQuery: false,
    }),
    Order.count({
      where,
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: [],
        },
      ],
      distinct: true,
      col: "id",
      subQuery: false,
    }),
  ]);

  const orderIds = orders
    .map((order) => Number(order.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  const tagsByOrderId = new Map<string, Array<{ id: number; name: string }>>();
  if (orderIds.length > 0) {
    const assignments = await OrderTagAssignment.findAll({
      where: { order_id: orderIds },
      include: [
        {
          model: OrderTag,
          as: "tag",
          attributes: ["id", "name"],
        },
      ],
      order: [[{ model: OrderTag, as: "tag" }, "name", "ASC"]],
    });

    assignments.forEach((assignment) => {
      const data = assignment.toJSON() as Record<string, unknown>;
      const orderId = Number(data.order_id);
      const tag = data.tag as { id: number; name: string } | undefined;
      if (!Number.isFinite(orderId) || !tag) return;
      const key = String(orderId);
      const list = tagsByOrderId.get(key) ?? [];
      list.push({ id: tag.id, name: tag.name });
      tagsByOrderId.set(key, list);
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const rows = orders.map((order) => {
    const data = order.toJSON() as Record<string, unknown>;
    const customer = (data.customer as Record<string, unknown>) ?? null;
    return {
      id: order.id,
      publicId: data.public_id as string,
      orderNumber: data.order_number ? Number(data.order_number) : null,
      status: data.status as string,
      paymentStatus: (data.payment_status as string | null) ?? null,
      customer: customer
        ? {
            first_name: customer.first_name as string | null,
            last_name: customer.last_name as string | null,
            email: customer.email as string | null,
          }
        : null,
      totalCents: Number(data.total_cents ?? 0),
      deliveryStatus: (data.delivery_status as string | null) ?? null,
      shippingTitle:
        typeof data.shipping_option_title === "string"
          ? data.shipping_option_title
          : null,
      createdAt: data.created_at as Date,
      itemsCount: Number(data.items_count ?? 0),
      tags: tagsByOrderId.get(String(order.id)) ?? [],
    };
  });

  return (
    <AdminShell title="Orders" current="orders" action={getActionButton()}>
      <Card className="border-neutral-200 bg-white shadow-sm">
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {[
                { key: "all", label: "All", value: null },
                { key: "unfulfilled", label: "Unfulfilled", value: "unfulfilled" },
                { key: "unpaid", label: "Unpaid", value: "unpaid" },
                { key: "open", label: "Open", value: "open" },
                { key: "archived", label: "Archived", value: "archived" },
              ].map((item) => {
                const isActive =
                  (item.value === null && !statusParam) ||
                  item.value === statusParam;
                return (
                  <Button
                    key={item.key}
                    asChild
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                  >
                    <Link
                      href={buildQueryHref(resolvedSearchParams, {
                        status: item.value,
                        page: null,
                      })}
                    >
                      {item.label}
                    </Link>
                  </Button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form
                className="flex items-center gap-2"
                action="/admin/orders"
                method="get"
              >
                {statusParam ? (
                  <input type="hidden" name="status" value={statusParam} />
                ) : null}
                {sortParam ? (
                  <input type="hidden" name="sort" value={sortKey} />
                ) : null}
                {orderParam ? (
                  <input type="hidden" name="order" value={orderParamNormalized} />
                ) : null}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="search"
                    name="query"
                    defaultValue={queryParam ?? ""}
                    placeholder="Search orders"
                    className="h-9 w-56 rounded-md border border-neutral-200 bg-white pl-8 pr-9 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-400"
                  />
                  <button
                    type="submit"
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
                    aria-label="Search orders"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              </form>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-3">
                  <form action="/admin/orders" method="get" className="space-y-3">
                    {statusParam ? (
                      <input type="hidden" name="status" value={statusParam} />
                    ) : null}
                    {queryParam ? (
                      <input type="hidden" name="query" value={queryParam} />
                    ) : null}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-500">
                        Sort by
                      </label>
                      <select
                        name="sort"
                        defaultValue={sortKey}
                        className="h-9 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm"
                      >
                        <option value="title">Title</option>
                        <option value="created">Created</option>
                        <option value="updated">Updated</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-500">
                        Order
                      </label>
                      <select
                        name="order"
                        defaultValue={orderParamNormalized}
                        className="h-9 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm"
                      >
                        <option value="desc">Newest first</option>
                        <option value="asc">Older first</option>
                      </select>
                    </div>
                    <Button type="submit" size="sm" className="w-full">
                      Apply
                    </Button>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox" aria-label="Select all orders" />
                </TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment status</TableHead>
                <TableHead>Fulfillment status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Delivery status</TableHead>
                <TableHead>Delivery method</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-sm text-neutral-500">
                    No orders found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const payment = getPaymentStatus(row.status, row.paymentStatus);
                  const fulfillment = getFulfillmentStatus(row.status);
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Select order ${row.publicId}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/orders/${row.publicId}`}
                          className="text-neutral-900 hover:underline"
                        >
                          {formatOrderNumber(row.orderNumber, row.id)}
                        </Link>
                      </TableCell>
                      <TableCell>{formatRelativeDate(row.createdAt)}</TableCell>
                      <TableCell>
                        {formatCustomerName(row.customer ?? undefined)}
                      </TableCell>
                      <TableCell>{formatCurrency(row.totalCents)}</TableCell>
                      <TableCell>
                        <Badge variant={payment.variant} className="gap-1">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${payment.dot}`}
                          />
                          {payment.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={fulfillment.className}
                        >
                          {fulfillment.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.itemsCount} {row.itemsCount === 1 ? "item" : "items"}
                      </TableCell>
                      <TableCell className="text-neutral-500">
                        {row.deliveryStatus ? (
                          <Badge variant="outline" className="text-xs">
                            {row.deliveryStatus}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-neutral-500">
                        {row.shippingTitle?.trim() ? (
                          <Badge variant="outline" className="text-xs">
                            {row.shippingTitle.trim()}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {row.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.tags.map((tag) => (
                              <Badge key={tag.id} variant="outline" className="text-xs">
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              {canPrev ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={buildPageHref(resolvedSearchParams, page - 1)}>
                    Previous
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              )}
              {canNext ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={buildPageHref(resolvedSearchParams, page + 1)}>
                    Next
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
