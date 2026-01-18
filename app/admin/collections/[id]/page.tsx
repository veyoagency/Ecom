import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import CollectionEditorClient from "@/app/admin/collections/[id]/CollectionEditorClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-config";
import { Collection, Product, ProductImage } from "@/lib/models";

export const metadata = {
  title: "Edit collection",
};

export default async function AdminCollectionEditPage({
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
  const collectionId = Number(id);
  if (!Number.isFinite(collectionId)) {
    notFound();
  }

  const [collection, products] = await Promise.all([
    Collection.findByPk(collectionId, {
      attributes: ["id", "title", "description", "image_url"],
    }),
    Product.findAll({
      attributes: ["id", "title", "price_cents", "active", "created_at"],
      include: [
        {
          model: Collection,
          as: "collections",
          attributes: [],
          through: { attributes: [] },
          where: { id: collectionId },
        },
        {
          model: ProductImage,
          as: "images",
          attributes: ["url", "position"],
          required: false,
        },
      ],
      order: [
        ["created_at", "DESC"],
        [{ model: ProductImage, as: "images" }, "position", "ASC"],
      ],
      distinct: true,
    }),
  ]);

  if (!collection) {
    notFound();
  }

  const productItems = products.map((product) => {
    const productJson = product.toJSON() as {
      id: number;
      title: string;
      price_cents: number;
      active: boolean;
      created_at: Date;
      images?: Array<{ url: string; position: number | null }>;
    };
    const images = productJson.images ?? [];
    const firstImage = images
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
    return {
      id: Number(productJson.id),
      title: productJson.title,
      priceCents: productJson.price_cents,
      active: productJson.active,
      createdAt: productJson.created_at.toISOString(),
      imageUrl: firstImage?.url ?? null,
    };
  });

  return (
    <CollectionEditorClient
      collection={{
        id: Number(collection.id),
        title: collection.title,
        descriptionHtml: collection.description ?? "",
        imageUrl: collection.image_url ?? null,
      }}
      products={productItems}
    />
  );
}
