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
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-config";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { Op, Order, OrderItem } from "@/lib/models";
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
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
    where.status = { [Op.in]: ["fulfilled", "cancelled"] };
  }
  if (queryParam) {
    where[Op.or] = [
      { public_id: { [Op.iLike]: `%${queryParam}%` } },
      { email: { [Op.iLike]: `%${queryParam}%` } },
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
        "status",
        "email",
        "total_cents",
        "created_at",
        [Sequelize.fn("COUNT", Sequelize.col("items.id")), "items_count"],
      ],
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: [],
        },
      ],
      group: ["Order.id"],
      where,
      order: [[Sequelize.col(orderColumn), orderKey]],
      limit,
      offset,
      subQuery: false,
    }),
    Order.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const rows = orders.map((order) => {
    const data = order.toJSON() as Record<string, unknown>;
    return {
      id: order.id,
      publicId: data.public_id as string,
      status: data.status as string,
      email: data.email as string,
      totalCents: Number(data.total_cents ?? 0),
      createdAt: data.created_at as Date,
      itemsCount: Number(data.items_count ?? 0),
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
                  <Button variant="outline" size="sm">
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
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-neutral-500">
                    No orders found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.publicId}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.itemsCount}</TableCell>
                    <TableCell>{formatCurrency(row.totalCents)}</TableCell>
                    <TableCell>{formatDate(row.createdAt)}</TableCell>
                  </TableRow>
                ))
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
