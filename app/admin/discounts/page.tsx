import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sequelize } from "sequelize";

import DiscountsClient from "@/app/admin/discounts/DiscountsClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-config";
import { DiscountCode, Op, Order } from "@/lib/models";

export const metadata = {
  title: "Discounts",
};

export default async function AdminDiscountsPage() {
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

  const [discounts, usageRows] = await Promise.all([
    DiscountCode.findAll({ order: [["created_at", "DESC"]] }),
    Order.findAll({
      attributes: [
        "discount_code_id",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "usage_count"],
      ],
      where: {
        discount_code_id: {
          [Op.not]: null,
        },
      },
      group: ["discount_code_id"],
    }),
  ]);

  const usageMap = new Map<number, number>();
  usageRows.forEach((row) => {
    const data = row.toJSON() as Record<string, unknown>;
    const id = Number(data.discount_code_id);
    const count = Number(data.usage_count ?? 0);
    if (Number.isFinite(id)) {
      usageMap.set(id, count);
    }
  });

  const payload = discounts.map((discount) => ({
    id: discount.id,
    code: discount.code,
    discount_type: discount.discount_type,
    amount_cents: discount.amount_cents,
    percent_off: discount.percent_off,
    active: discount.active,
    usage_count: usageMap.get(discount.id) ?? 0,
  }));

  return <DiscountsClient discounts={payload} />;
}
