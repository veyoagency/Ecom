import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import AdminShell from "@/app/admin/components/AdminShell";
import ClickableTableRow from "@/app/admin/components/ClickableTableRow";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Collection, Op, Product, ProductCollection, ProductImage } from "@/lib/models";
import { Filter, Search } from "lucide-react";

export const metadata = {
  title: "Products",
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
      <Link href="/admin/products/new">Add product</Link>
    </Button>
  );
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
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
  return query ? `/admin/products?${query}` : "/admin/products";
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
  return query ? `/admin/products?${query}` : "/admin/products";
}

export default async function AdminProductsPage({
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
  if (statusParam === "active") {
    where.active = true;
  } else if (statusParam === "draft") {
    where.active = false;
  }
  if (queryParam) {
    where.title = { [Op.iLike]: `%${queryParam}%` };
  }

  const sortKey =
    sortParam === "title" || sortParam === "updated" || sortParam === "created"
      ? sortParam
      : "created";
  const orderKey = orderParam === "asc" ? "ASC" : "DESC";
  const orderParamNormalized = orderKey === "ASC" ? "asc" : "desc";
  const orderColumn =
    sortKey === "title"
      ? "title"
      : sortKey === "updated"
        ? "updated_at"
        : "created_at";

  const [products, total] = await Promise.all([
    Product.findAll({
      attributes: ["id", "title", "price_cents", "active", "created_at"],
      where,
      order: [[orderColumn, orderKey]],
      limit,
      offset,
    }),
    Product.count({ where }),
  ]);

  const productIds = products.map((product) => product.id);
  const [productImages, productCollections] = await Promise.all([
    productIds.length
      ? ProductImage.findAll({
          attributes: ["product_id", "url", "position"],
          where: { product_id: productIds },
          order: [
            ["product_id", "ASC"],
            ["position", "ASC"],
          ],
        })
      : [],
    productIds.length
      ? ProductCollection.findAll({
          attributes: ["product_id"],
          where: { product_id: productIds },
          include: [{ model: Collection, attributes: ["id", "title"] }],
          raw: true,
          nest: true,
        })
      : [],
  ]);

  const firstImageByProduct = new Map<number, string>();
  productImages.forEach((image) => {
    if (!firstImageByProduct.has(image.product_id)) {
      firstImageByProduct.set(image.product_id, image.url);
    }
  });

  const collectionsByProduct = new Map<number, { id: number; title: string }[]>();
  productCollections.forEach((entry) => {
    const record = entry as {
      product_id: number;
      Collection?: { id: number; title: string };
    };
    if (!record.Collection) return;
    const existing = collectionsByProduct.get(record.product_id) ?? [];
    existing.push(record.Collection);
    collectionsByProduct.set(record.product_id, existing);
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <AdminShell title="Products" current="products" action={getActionButton()}>
      <Card className="border-neutral-200 bg-white shadow-sm">
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {[
                { key: "all", label: "All", value: null },
                { key: "active", label: "Active", value: "active" },
                { key: "draft", label: "Draft", value: "draft" },
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
                action="/admin/products"
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
                    placeholder="Search products"
                    className="h-9 w-48 rounded-md border border-neutral-200 bg-white pl-8 pr-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-400"
                  />
                </div>
                <Button type="submit" variant="outline" size="sm">
                  Search
                </Button>
              </form>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-3">
                  <form action="/admin/products" method="get" className="space-y-3">
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
                <TableHead aria-label="Thumbnail"></TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Collections</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-neutral-500"
                  >
                    No products found.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => {
                  const imageUrl = firstImageByProduct.get(product.id);
                  const collections = collectionsByProduct.get(product.id) ?? [];
                  return (
                    <ClickableTableRow
                      key={product.id}
                      href={`/admin/products/${product.id}`}
                    >
                      <TableCell className="w-[56px]">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product.title}
                            className="h-10 w-10 shrink-0 rounded-md border border-neutral-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100 text-[10px] text-neutral-500">
                            No image
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{product.title}</TableCell>
                      <TableCell>
                        <Badge variant={product.active ? "success" : "muted"}>
                          {product.active ? "Active" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {collections.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {collections.map((collection) => (
                              <Badge
                                key={`${product.id}-${collection.id}`}
                                variant="outline"
                                className="border-neutral-200 text-neutral-600"
                              >
                                {collection.title}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-500">—</span>
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(product.price_cents)}</TableCell>
                      <TableCell>{formatDateTime(product.created_at)}</TableCell>
                    </ClickableTableRow>
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
