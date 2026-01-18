"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";

import AdminShell from "@/app/admin/components/AdminShell";
import ClickableTableRow from "@/app/admin/components/ClickableTableRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";

type CollectionEditorProduct = {
  id: number;
  title: string;
  priceCents: number;
  active: boolean;
  createdAt: string;
  imageUrl?: string | null;
};

type CollectionEditorProps = {
  collection: {
    id: number;
    title: string;
    slug: string;
    descriptionHtml: string;
    imageUrl: string | null;
    listingActive: boolean;
  };
  products: CollectionEditorProduct[];
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

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

export default function CollectionEditorClient({
  collection,
  products,
}: CollectionEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(collection.title);
  const [slug, setSlug] = useState(collection.slug);
  const [listingActive, setListingActive] = useState(
    collection.listingActive ?? true,
  );
  const [descriptionHtml, setDescriptionHtml] = useState(
    collection.descriptionHtml ?? "",
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(
    collection.imageUrl ?? "",
  );
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!imageFile) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      return;
    }
    const url = URL.createObjectURL(imageFile);
    previewUrlRef.current = url;
    setImagePreview(url);
    return () => {
      URL.revokeObjectURL(url);
      previewUrlRef.current = null;
    };
  }, [imageFile]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setImageFile(file);
    setRemoveImage(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    multiple: false,
    onDrop,
  });

  const isValid = useMemo(
    () => Boolean(title.trim()) && Boolean(slug.trim()),
    [title, slug],
  );

  async function handleSubmit() {
    if (loading) return;
    if (!isValid) {
      setError("Collection name and slug are required.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("slug", slug.trim());
      formData.append("description", descriptionHtml.trim());
      formData.append("listing_active", listingActive ? "1" : "0");
      if (imageFile) {
        formData.append("image", imageFile);
      } else if (removeImage) {
        formData.append("remove_image", "1");
      }

      const response = await fetch(`/api/admin/collections/${collection.id}`, {
        method: "PUT",
        body: formData,
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || "Failed to update collection.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Failed to update collection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell
      title="Edit collection"
      current="collections"
      action={
        <div className="flex items-center gap-2">
          {slug.trim() ? (
            <Button asChild variant="outline" size="sm">
              <a
                href={`/collections/${slug.trim()}`}
                target="_blank"
                rel="noreferrer"
              >
                View
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              View
            </Button>
          )}
          <Button size="sm" onClick={handleSubmit} disabled={!isValid || loading}>
            {loading ? "Saving..." : "Save changes"}
          </Button>
        </div>
      }
    >
      <div className="admin-product-grid">
        <div className="flex flex-col gap-6">
          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardContent className="space-y-6 pt-6">
              <Field>
                <FieldLabel htmlFor="collection-title">Title</FieldLabel>
                <Input
                  id="collection-title"
                  name="title"
                  placeholder="Collection name"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="collection-description">
                  Description
                </FieldLabel>
                <div className="simple-editor-embed rounded-md border border-neutral-200">
                  <SimpleEditor
                    initialContent={descriptionHtml}
                    variant="embedded"
                    onUpdate={({ html }) => {
                      setDescriptionHtml(html);
                    }}
                  />
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="collection-image">Image</FieldLabel>
                <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-4">
                  <div
                    {...getRootProps({
                      className: `flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-neutral-200 bg-white px-4 py-6 text-center transition ${
                        isDragActive
                          ? "border-neutral-900 bg-neutral-100"
                          : "hover:border-neutral-300"
                      }`,
                    })}
                  >
                    <input {...getInputProps()} />
                    <p className="text-sm font-medium text-neutral-700">
                      {isDragActive
                        ? "Drop the image here"
                        : "Drag and drop an image"}
                    </p>
                    <p className="text-xs text-neutral-500">or click to browse</p>
                  </div>
                  {imagePreview ? (
                    <div className="mt-4 flex items-center gap-4">
                      <img
                        src={imagePreview}
                        alt="Collection preview"
                        className="h-20 w-20 rounded-md border border-neutral-200 object-cover"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview("");
                          setRemoveImage(true);
                        }}
                      >
                        Remove image
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Field>

              {error ? <FieldError>{error}</FieldError> : null}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Slug</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field>
                <FieldLabel htmlFor="collection-slug">Slug</FieldLabel>
                <Input
                  id="collection-slug"
                  name="slug"
                  placeholder="collection-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  required
                />
              </Field>
            </CardContent>
          </Card>
          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Listing</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-900">Visible</p>
                <p className="text-xs text-neutral-500">
                  Show this collection in storefront lists.
                </p>
              </div>
              <Switch
                checked={listingActive}
                onCheckedChange={setListingActive}
                aria-label="Toggle collection listing"
              />
            </CardContent>
          </Card>
          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Products in this collection</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thumbnail</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-neutral-500"
                      >
                        No products in this collection yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product) => (
                      <ClickableTableRow
                        key={product.id}
                        href={`/admin/products/${product.id}`}
                      >
                        <TableCell className="w-[56px]">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.title}
                              className="h-10 w-10 shrink-0 rounded-md border border-neutral-200 object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100 text-[10px] text-neutral-500">
                              No image
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {product.title}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              product.active
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border border-neutral-200 bg-neutral-100 text-neutral-600"
                            }
                          >
                            {product.active ? "Active" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(product.priceCents)}</TableCell>
                        <TableCell>{formatDateTime(product.createdAt)}</TableCell>
                      </ClickableTableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
