import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import AddProductClient from "@/app/admin/products/new/AddProductClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-config";
import {
  Collection,
  Product,
  ProductImage,
  ProductOption,
  ProductOptionValue,
} from "@/lib/models";

export const metadata = {
  title: "Edit product",
};

function inferMediaKind(url: string): "image" | "video" {
  return /\.(mp4|webm|mov)$/i.test(url) ? "video" : "image";
}

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) {
    notFound();
  }

  const [product, collections] = await Promise.all([
    Product.findByPk(productId, {
      attributes: [
        "id",
        "title",
        "slug",
        "description_html",
        "price_cents",
        "compare_at_cents",
        "active",
        "in_stock",
      ],
      include: [
        {
          model: ProductImage,
          as: "images",
          attributes: ["url", "position"],
          required: false,
        },
        {
          model: Collection,
          as: "collections",
          attributes: ["id", "title", "slug"],
          through: { attributes: [] },
          required: false,
        },
        {
          model: ProductOption,
          as: "options",
          attributes: ["id", "name", "position"],
          required: false,
          include: [
            {
              model: ProductOptionValue,
              as: "values",
              attributes: ["id", "value", "position", "image_url"],
              required: false,
            },
          ],
        },
      ],
    }),
    Collection.findAll({
      attributes: ["id", "title", "slug"],
      order: [["title", "ASC"]],
    }),
  ]);

  if (!product) {
    notFound();
  }

  const productJson = product.toJSON() as {
    id: number;
    title: string;
    slug: string;
    description_html: string | null;
    price_cents: number;
    compare_at_cents: number | null;
    weight_kg?: string | null;
    active: boolean;
    in_stock?: boolean;
    images?: Array<{ url: string; position: number | null }>;
    collections?: Array<{ id: number; title: string; slug: string | null }>;
    options?: Array<{
      name: string;
      position: number | null;
      values?: Array<{
        value: string;
        position: number | null;
        image_url?: string | null;
      }>;
    }>;
  };

  const media = (productJson.images ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((image) => ({
      url: image.url,
      position: image.position ?? 0,
      kind: inferMediaKind(image.url),
    }));

  const variants = (productJson.options ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((option) => ({
      name: option.name,
      values: (option.values ?? [])
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((value) => ({
          value: value.value,
          imageUrl: value.image_url ?? null,
        })),
    }))
    .filter((option) => option.name && option.values.length > 0);

  return (
    <AddProductClient
      collections={collections.map((collection) => ({
        id: Number(collection.id),
        title: collection.title,
        slug: collection.slug,
      }))}
      product={{
        id: Number(productJson.id),
        title: productJson.title,
        slug: productJson.slug,
        descriptionHtml: productJson.description_html ?? "",
        priceCents: productJson.price_cents,
        compareAtCents: productJson.compare_at_cents,
        weightKg: productJson.weight_kg ?? null,
        active: productJson.active,
        inStock: productJson.in_stock ?? true,
        collectionIds: (productJson.collections ?? []).map((collection) =>
          Number(collection.id),
        ),
        media,
        variants,
      }}
    />
  );
}
