"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";

import AdminShell from "@/app/admin/components/AdminShell";
import ClickableTableRow from "@/app/admin/components/ClickableTableRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CollectionItem = {
  id: number;
  title: string;
  slug: string | null;
  imageUrl: string | null;
  listingActive: boolean;
  created_at: string;
  updated_at: string;
  productCount: number;
};

type CollectionsClientProps = {
  collections: CollectionItem[];
};

function formatDateTime(value: string) {
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

export default function CollectionsClient({
  collections,
}: CollectionsClientProps) {
  const searchParams = useSearchParams();
  const queryParam = searchParams.get("query") ?? "";
  const sortParam = searchParams.get("sort");
  const orderParam = searchParams.get("order");
  const [items, setItems] = useState<CollectionItem[]>(collections);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sortKey =
    sortParam === "title" || sortParam === "updated" || sortParam === "created"
      ? sortParam
      : "created";
  const orderKey = orderParam === "asc" ? "asc" : "desc";

  const filteredItems = useMemo(() => {
    let next = [...items];
    if (queryParam) {
      const query = queryParam.toLowerCase();
      next = next.filter((item) =>
        item.title.toLowerCase().includes(query),
      );
    }
    next.sort((a, b) => {
      const direction = orderKey === "asc" ? 1 : -1;
      if (sortKey === "title") {
        return a.title.localeCompare(b.title) * direction;
      }
      const dateA =
        sortKey === "updated" ? new Date(a.updated_at) : new Date(a.created_at);
      const dateB =
        sortKey === "updated" ? new Date(b.updated_at) : new Date(b.created_at);
      return (dateA.getTime() - dateB.getTime()) * direction;
    });
    return next;
  }, [items, orderKey, queryParam, sortKey]);

  async function handleSubmit() {
    if (loading) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Collection name is required.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || "Failed to create collection.");
        setLoading(false);
        return;
      }

      const created = data?.collection as
        | {
            id: number;
            title: string;
            slug: string | null;
            image_url?: string | null;
            listing_active?: boolean;
            created_at: string;
            updated_at: string;
          }
        | undefined;
      if (created) {
        setItems((prev) => [
          {
            id: created.id,
            title: created.title,
            slug: created.slug ?? null,
            imageUrl: created.image_url ?? null,
            listingActive: created.listing_active ?? true,
            created_at: created.created_at,
            updated_at: created.updated_at,
            productCount: 0,
          },
          ...prev,
        ]);
      }
      setName("");
      setOpen(false);
    } catch {
      setError("Failed to create collection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setError("");
          setName("");
        }
      }}
    >
      <AdminShell
        title="Collections"
        current="collections"
        action={
          <DialogTrigger asChild>
            <Button size="sm">Add collection</Button>
          </DialogTrigger>
        }
      >
        <Card className="border-neutral-200 bg-white shadow-sm">
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <form
                  className="flex items-center gap-2"
                  action="/admin/collections"
                  method="get"
                >
                  {sortParam ? (
                    <input type="hidden" name="sort" value={sortKey} />
                  ) : null}
                  {orderParam ? (
                    <input type="hidden" name="order" value={orderKey} />
                  ) : null}
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="search"
                      name="query"
                      defaultValue={queryParam}
                      placeholder="Search collections"
                      className="h-9 w-56 rounded-md border border-neutral-200 bg-white pl-8 pr-9 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-400"
                    />
                    <button
                      type="submit"
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
                      aria-label="Search collections"
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
                    <form
                      action="/admin/collections"
                      method="get"
                      className="space-y-3"
                    >
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
                          defaultValue={orderKey}
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
                  <TableHead className="w-16" />
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Listing</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-neutral-500"
                    >
                      No collections found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((collection) => (
                    <ClickableTableRow
                      key={collection.id}
                      href={`/admin/collections/${collection.id}`}
                    >
                      <TableCell>
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-neutral-100">
                          {collection.imageUrl ? (
                            <img
                              src={collection.imageUrl}
                              alt={collection.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-4 w-4 rounded-full bg-neutral-200" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {collection.title}
                      </TableCell>
                      <TableCell>{collection.slug}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            collection.listingActive
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border border-neutral-200 bg-neutral-100 text-neutral-600"
                          }
                        >
                          {collection.listingActive ? "Active" : "Hidden"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDateTime(collection.created_at)}
                      </TableCell>
                    </ClickableTableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </AdminShell>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add collection</DialogTitle>
          <DialogDescription>
            Create a new collection to organize products.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Collection name"
          />
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
