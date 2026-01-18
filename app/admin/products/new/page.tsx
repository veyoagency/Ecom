import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
import { Collection } from "@/lib/models";

export const metadata = {
  title: "Add product",
};

export default async function AdminAddProductPage() {
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

  const collections = await Collection.findAll({
    attributes: ["id", "title", "slug"],
    order: [["title", "ASC"]],
  });

  return (
    <AddProductClient
      collections={collections.map((collection) => ({
        id: Number(collection.id),
        title: collection.title,
        slug: collection.slug,
      }))}
    />
  );
}
