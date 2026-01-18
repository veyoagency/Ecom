import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sequelize } from "sequelize";

import CollectionsClient from "@/app/admin/collections/CollectionsClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-config";
import { Collection, ProductCollection } from "@/lib/models";

export const metadata = {
  title: "Collections",
};

export default async function AdminCollectionsPage() {
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

  const [collections, collectionCounts] = await Promise.all([
    Collection.findAll({
      attributes: ["id", "title", "slug", "image_url", "created_at", "updated_at"],
      order: [["title", "ASC"]],
    }),
    ProductCollection.findAll({
      attributes: [
        "collection_id",
        [Sequelize.fn("COUNT", Sequelize.col("collection_id")), "product_count"],
      ],
      group: ["collection_id"],
      raw: true,
    }),
  ]);

  const countsById = new Map<number, number>();
  collectionCounts.forEach((row) => {
    const record = row as { collection_id: number; product_count: string };
    countsById.set(Number(record.collection_id), Number(record.product_count));
  });

  return (
    <CollectionsClient
      collections={collections.map((collection) => ({
        id: Number(collection.id),
        title: collection.title,
        slug: collection.slug,
        imageUrl: collection.image_url ?? null,
        created_at: collection.created_at.toISOString(),
        updated_at: collection.updated_at.toISOString(),
        productCount: countsById.get(Number(collection.id)) ?? 0,
      }))}
    />
  );
}
