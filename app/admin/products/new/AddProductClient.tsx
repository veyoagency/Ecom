"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDropzone } from "react-dropzone";
import { Eye, Plus, X } from "lucide-react";

import AdminShell from "@/app/admin/components/AdminShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";

type CollectionOption = {
  id: number;
  title: string;
  slug: string | null;
};

type ProductVariantInput = {
  name: string;
  values: string[];
};

type ProductMediaInput = {
  url: string;
  position: number;
  kind: "image" | "video";
};

type ProductInitial = {
  id: number;
  title: string;
  slug: string;
  descriptionHtml: string;
  priceCents: number;
  compareAtCents: number | null;
  active: boolean;
  collectionIds: number[];
  media: ProductMediaInput[];
  variants: ProductVariantInput[];
};

type AddProductClientProps = {
  collections: CollectionOption[];
  product?: ProductInitial;
};

type MediaItem = {
  id: string;
  file?: File;
  url: string;
  kind: "image" | "video";
  isNew: boolean;
};

type VariantValue = {
  id: string;
  value: string;
};

type VariantOption = {
  id: string;
  name: string;
  values: VariantValue[];
};

const selectClassName =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm";

function createMediaId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function inferMediaKind(url: string): "image" | "video" {
  return /\.(mp4|webm|mov)$/i.test(url) ? "video" : "image";
}

function formatAmount(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return (value / 100).toFixed(2);
}

function SortableMediaItem({
  item,
  index,
  onRemove,
  onPreview,
}: {
  item: MediaItem;
  index: number;
  onRemove: (id: string) => void;
  onPreview: (id: string) => void;
}) {
  const label = item.file?.name ?? item.url.split("/").pop() ?? "media";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } satisfies React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex w-[100px] flex-col gap-1 ${isDragging ? "opacity-70" : ""}`}
    >
      <div
        className="relative h-[100px] w-[100px] cursor-grab overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        {item.kind === "video" ? (
          <video
            src={item.url}
            className="h-full w-full object-cover"
            draggable={false}
            muted
            playsInline
          />
        ) : (
          <img
            src={item.url}
            alt={label}
            className="h-full w-full object-cover"
            draggable={false}
          />
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(item.id);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1 text-neutral-600 opacity-0 transition group-hover:opacity-100"
          aria-label="Remove media"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="flex items-center justify-between text-xs text-neutral-900">
        <span className="font-medium text-black">{index + 1}</span>
        <button
          type="button"
          onClick={() => onPreview(item.id)}
          onPointerUp={() => onPreview(item.id)}
          className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-700 transition hover:bg-neutral-100"
          aria-label="Preview media"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function AddProductClient({
  collections,
  product,
}: AddProductClientProps) {
  const router = useRouter();
  const isEditing = Boolean(product);
  const [title, setTitle] = useState(product?.title ?? "");
  const [descriptionHtml, setDescriptionHtml] = useState(
    product?.descriptionHtml ?? "",
  );
  const [descriptionText, setDescriptionText] = useState(() =>
    stripHtml(product?.descriptionHtml ?? ""),
  );
  const [price, setPrice] = useState(formatAmount(product?.priceCents));
  const [compareAt, setCompareAt] = useState(
    formatAmount(product?.compareAtCents),
  );
  const [status, setStatus] = useState(
    product ? (product.active ? "active" : "draft") : "active",
  );
  const [collectionIds, setCollectionIds] = useState<string[]>(
    product ? product.collectionIds.map((id) => String(id)) : [],
  );
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => {
    if (!product) return [];
    return [...product.media]
      .sort((a, b) => a.position - b.position)
      .map((media) => ({
        id: createMediaId(),
        file: undefined,
        url: media.url,
        kind: media.kind ?? inferMediaKind(media.url),
        isNew: false,
      }));
  });
  const [variants, setVariants] = useState<VariantOption[]>(() => {
    if (!product) return [];
    return product.variants.map((variant) => ({
      id: createMediaId(),
      name: variant.name,
      values: variant.values.map((value) => ({
        id: createMediaId(),
        value,
      })),
    }));
  });
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<
    "duplicate" | "delete" | null
  >(null);

  const mediaItemsRef = useRef<MediaItem[]>([]);
  useEffect(() => {
    mediaItemsRef.current = mediaItems;
  }, [mediaItems]);
  useEffect(() => {
    return () => {
      mediaItemsRef.current.forEach((item) => {
        if (item.isNew) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setMediaItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return items;
        return arrayMove(items, oldIndex, newIndex);
      });
    },
    [setMediaItems],
  );

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    const nextItems = acceptedFiles.map((file) => ({
      id: createMediaId(),
      file,
      url: URL.createObjectURL(file),
      kind: file.type.startsWith("video/") ? "video" : "image",
      isNew: true,
    }));
    setMediaItems((items) => [...items, ...nextItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [], "video/*": [] },
    multiple: true,
    onDrop,
  });

  const isValid = useMemo(() => {
    return Boolean(title.trim() && descriptionText.trim() && price.trim());
  }, [title, descriptionText, price]);

  const selectedMediaLabel = useMemo(() => {
    if (!mediaItems.length) return "No media selected.";
    return `${mediaItems.length} file${mediaItems.length === 1 ? "" : "s"} selected`;
  }, [mediaItems.length]);

  const mediaIds = useMemo(
    () => mediaItems.map((item) => item.id),
    [mediaItems],
  );

  const handleRemoveMedia = useCallback((id: string) => {
    setMediaItems((items) => {
      const next = items.filter((item) => item.id !== id);
      const removed = items.find((item) => item.id === id);
      if (removed?.isNew) {
        URL.revokeObjectURL(removed.url);
      }
      return next;
    });
  }, []);

  const handleAddVariant = useCallback(() => {
    setVariants((items) => [
      ...items,
      {
        id: createMediaId(),
        name: "",
        values: [{ id: createMediaId(), value: "" }],
      },
    ]);
  }, []);

  const handleRemoveVariant = useCallback((variantId: string) => {
    setVariants((items) => items.filter((variant) => variant.id !== variantId));
  }, []);

  const handleVariantNameChange = useCallback(
    (variantId: string, name: string) => {
      setVariants((items) =>
        items.map((variant) =>
          variant.id === variantId ? { ...variant, name } : variant,
        ),
      );
    },
    [],
  );

  const handleAddVariantValue = useCallback((variantId: string) => {
    setVariants((items) =>
      items.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              values: [
                ...variant.values,
                { id: createMediaId(), value: "" },
              ],
            }
          : variant,
      ),
    );
  }, []);

  const handleRemoveVariantValue = useCallback(
    (variantId: string, valueId: string) => {
      setVariants((items) =>
        items.map((variant) =>
          variant.id === variantId
            ? {
                ...variant,
                values: variant.values.filter((value) => value.id !== valueId),
              }
            : variant,
        ),
      );
    },
    [],
  );

  const handleVariantValueChange = useCallback(
    (variantId: string, valueId: string, value: string) => {
      setVariants((items) =>
        items.map((variant) =>
          variant.id === variantId
            ? {
                ...variant,
                values: variant.values.map((entry) =>
                  entry.id === valueId ? { ...entry, value } : entry,
                ),
              }
            : variant,
        ),
      );
    },
    [],
  );

  const previewItem = useMemo(
    () => mediaItems.find((item) => item.id === previewId) ?? null,
    [mediaItems, previewId],
  );

  useEffect(() => {
    if (!previewId) return;
    if (!previewItem) {
      setPreviewId(null);
    }
  }, [previewId, previewItem]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || actionLoading) return;

    setError("");

    if (!isValid) {
      setError("Title, description, and price are required.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", descriptionHtml.trim());
      formData.append("price", price);
      if (compareAt.trim()) {
        formData.append("compare_at", compareAt);
      }
      formData.append("status", status);
      collectionIds.forEach((id) => formData.append("collections", id));
      const variantPayload = variants
        .map((variant) => ({
          name: variant.name.trim(),
          values: variant.values
            .map((value) => value.value.trim())
            .filter(Boolean),
        }))
        .filter((variant) => variant.name && variant.values.length > 0);
      if (variantPayload.length > 0) {
        formData.append("variants", JSON.stringify(variantPayload));
      }
      const mediaOrder: string[] = [];
      const newFiles: File[] = [];
      mediaItems.forEach((item) => {
        if (item.isNew && item.file) {
          mediaOrder.push(`new:${newFiles.length}`);
          newFiles.push(item.file);
        } else {
          mediaOrder.push(`existing:${item.url}`);
        }
      });
      formData.append("media_order", JSON.stringify(mediaOrder));
      newFiles.forEach((file) => formData.append("media", file));

      const response = await fetch(
        isEditing ? `/api/admin/products/${product?.id}` : "/api/admin/products",
        {
          method: isEditing ? "PUT" : "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error || "Failed to create product.");
        setLoading(false);
        return;
      }

      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("Failed to create product.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDuplicate() {
    if (!product || actionLoading || loading) return;
    setError("");
    setActionLoading("duplicate");
    try {
      const response = await fetch(
        `/api/admin/products/${product.id}/duplicate`,
        { method: "POST" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || "Failed to duplicate product.");
        return;
      }
      const newId = data?.product?.id;
      if (newId) {
        router.push(`/admin/products/${newId}`);
        router.refresh();
      }
    } catch {
      setError("Failed to duplicate product.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    if (!product || actionLoading || loading) return;
    setError("");
    setActionLoading("delete");
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || "Failed to delete product.");
        return;
      }
      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("Failed to delete product.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <AdminShell
      title={isEditing ? "Edit product" : "Add product"}
      current="products"
      action={
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDuplicate}
                disabled={Boolean(actionLoading)}
              >
                {actionLoading === "duplicate" ? "Duplicating..." : "Duplicate"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                disabled={Boolean(actionLoading)}
              >
                {actionLoading === "delete" ? "Deleting..." : "Delete"}
              </Button>
              {product?.slug ? (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`/produit/${product.slug}`}
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
            </>
          ) : null}
          <Button
            type="submit"
            size="sm"
            form="product-form"
            disabled={!isValid || loading || Boolean(actionLoading)}
          >
            {loading ? "Saving..." : isEditing ? "Save changes" : "Save"}
          </Button>
        </div>
      }
    >
      <form
        id="product-form"
        onSubmit={handleSubmit}
        className="admin-product-grid"
      >
        <div className="flex flex-col gap-6">
          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardContent className="space-y-6 pt-6">
              <Field>
                <FieldLabel htmlFor="product-title">Title</FieldLabel>
                <Input
                  id="product-title"
                  name="title"
                  placeholder="Short sleeve t-shirt"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="product-description">Description</FieldLabel>
                <div className="simple-editor-embed rounded-md border border-neutral-200">
                  <SimpleEditor
                    initialContent={descriptionHtml}
                    variant="embedded"
                    onUpdate={({ html, text }) => {
                      setDescriptionHtml(html);
                      setDescriptionText(text);
                    }}
                  />
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="product-media">Media</FieldLabel>
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
                        ? "Drop files here"
                        : "Drag and drop images or videos"}
                    </p>
                    <p className="text-xs text-neutral-500">
                      or click to browse
                    </p>
                  </div>

                  {mediaItems.length > 0 ? (
                    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                      <SortableContext
                        items={mediaIds}
                        strategy={rectSortingStrategy}
                      >
                        <div className="mt-4 flex flex-wrap gap-3">
                          {mediaItems.map((item, index) => (
                            <SortableMediaItem
                              key={item.id}
                              item={item}
                              index={index}
                              onRemove={handleRemoveMedia}
                              onPreview={setPreviewId}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <p className="mt-3 text-xs text-neutral-500">
                      No media yet.
                    </p>
                  )}
                </div>
                <FieldDescription className="text-xs text-neutral-500">
                  {selectedMediaLabel} • Drag thumbnails to reorder.
                </FieldDescription>
              </Field>
              {error ? <FieldError>{error}</FieldError> : null}
            </CardContent>
          </Card>

          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Price</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="product-price">Price</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                    €
                  </span>
                  <Input
                    id="product-price"
                    name="price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-7"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    required
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="product-compare">Compare at</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                    €
                  </span>
                  <Input
                    id="product-compare"
                    name="compare_at"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-7"
                    value={compareAt}
                    onChange={(event) => setCompareAt(event.target.value)}
                  />
                </div>
              </Field>
            </CardContent>
          </Card>

          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Variants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {variants.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No variants yet. Add size, color, or any custom option.
                </p>
              ) : (
                <div className="space-y-4">
                  {variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="rounded-md border border-neutral-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <FieldLabel htmlFor={`variant-${variant.id}`}>
                            Variant name
                          </FieldLabel>
                          <Input
                            id={`variant-${variant.id}`}
                            placeholder="Size, Color, Material"
                            value={variant.name}
                            onChange={(event) =>
                              handleVariantNameChange(
                                variant.id,
                                event.target.value,
                              )
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(variant.id)}
                          className="mt-7 inline-flex items-center rounded-full border border-neutral-200 p-1 text-neutral-500 transition hover:bg-neutral-100"
                          aria-label="Remove variant"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-4 space-y-3">
                        <FieldLabel>Values</FieldLabel>
                        {variant.values.map((value) => (
                          <div
                            key={value.id}
                            className="flex items-center gap-2"
                          >
                            <Input
                              placeholder="Small, Red, Cotton"
                              value={value.value}
                              onChange={(event) =>
                                handleVariantValueChange(
                                  variant.id,
                                  value.id,
                                  event.target.value,
                                )
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveVariantValue(
                                  variant.id,
                                  value.id,
                                )
                              }
                              className="inline-flex items-center rounded-full border border-neutral-200 p-1 text-neutral-500 transition hover:bg-neutral-100"
                              aria-label="Remove value"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddVariantValue(variant.id)}
                          className="w-fit"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add value
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button type="button" variant="outline" onClick={handleAddVariant}>
                <Plus className="mr-2 h-4 w-4" />
                Add variant
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                id="product-status"
                name="status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={selectClassName}
    >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </CardContent>
          </Card>

          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Collections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field>
                <FieldLabel htmlFor="product-collections">
                  Add to collections
                </FieldLabel>
                <div className="rounded-md border border-neutral-200 bg-white p-3">
                  {collections.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      No collections yet.
                    </p>
                  ) : (
                    <div className="max-h-48 space-y-2 overflow-auto">
                      {collections.map((collection) => {
                        const id = String(collection.id);
                        const checked = collectionIds.includes(id);
                        return (
                          <label
                            key={collection.id}
                            className="flex items-start gap-2 text-sm text-neutral-700"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-neutral-300"
                              checked={checked}
                              onChange={(event) => {
                                setCollectionIds((items) =>
                                  event.target.checked
                                    ? [...items, id]
                                    : items.filter((item) => item !== id),
                                );
                              }}
                            />
                            <span className="leading-5">
                              {collection.title}
                              {collection.slug ? (
                                <span className="text-xs text-neutral-400">
                                  {" "}
                                  ({collection.slug})
                                </span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Field>
              <p className="text-xs text-neutral-500">
                Select one or more existing collections. Create collections in
                the collections page.
              </p>
            </CardContent>
          </Card>
        </div>
      </form>
      <Dialog
        open={Boolean(previewItem)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewId(null);
          }
        }}
      >
        {previewItem ? (
          <DialogContent
            className="h-[90vh] w-[92vw] max-w-none overflow-hidden border-none bg-black p-0"
            showCloseButton={false}
          >
            <VisuallyHidden>
              <DialogTitle>Media preview</DialogTitle>
              <DialogDescription>
                Full-size preview of the selected media.
              </DialogDescription>
            </VisuallyHidden>
            <button
              type="button"
              onClick={() => setPreviewId(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black p-3 text-white shadow-lg"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-full w-full items-center justify-center bg-black">
              {previewItem.kind === "video" ? (
                <video
                  src={previewItem.url}
                  controls
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <img
                  src={previewItem.url}
                  alt={previewItem.file?.name ?? "Media preview"}
                  className="max-h-full max-w-full object-contain"
                />
              )}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete product?</DialogTitle>
            <DialogDescription>
              This will permanently remove the product and its media.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={actionLoading === "delete"}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={actionLoading === "delete"}
            >
              {actionLoading === "delete" ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
