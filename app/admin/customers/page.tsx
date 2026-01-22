import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sequelize } from "sequelize";

import AdminShell from "@/app/admin/components/AdminShell";
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
import { Customer, Op, Order } from "@/lib/models";

export const metadata = {
  title: "Customers",
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatCustomerName(customer: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  const fullName = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
  return fullName || customer.email || "Client";
}

export default async function AdminCustomersPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    redirect("/admin/login");
  }

  const email = session.user.email?.toLowerCase();
  if (!isAdminEmail(email)) {
    redirect("/admin/login");
  }

  const customers = await Customer.findAll({
    order: [["created_at", "DESC"]],
  });

  const stats = await Order.findAll({
    attributes: [
      "customer_id",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "orders_count"],
      [
        Sequelize.fn(
          "COALESCE",
          Sequelize.fn("SUM", Sequelize.col("total_cents")),
          0,
        ),
        "amount_spent_cents",
      ],
    ],
    where: {
      customer_id: {
        [Op.not]: null,
      },
    },
    group: ["customer_id"],
  });

  const statsByCustomer = new Map<
    number,
    { ordersCount: number; amountSpentCents: number }
  >();
  stats.forEach((row) => {
    const data = row.toJSON() as Record<string, unknown>;
    const customerId = Number(data.customer_id);
    if (!Number.isFinite(customerId)) return;
    statsByCustomer.set(customerId, {
      ordersCount: Number(data.orders_count ?? 0),
      amountSpentCents: Number(data.amount_spent_cents ?? 0),
    });
  });

  const rows = customers.map((customer) => {
    const data = customer.toJSON() as Record<string, unknown>;
    const customerId = Number(data.id);
    const statsEntry = statsByCustomer.get(customerId);
    const city = (data.city as string | null) ?? "";
    const country = (data.country as string | null) ?? "";
    const location = [city, country].filter(Boolean).join(", ") || "-";
    const ordersCount = statsEntry?.ordersCount ?? 0;
    const amountSpentCents = statsEntry?.amountSpentCents ?? 0;
    return {
      id: customerId,
      name: formatCustomerName({
        first_name: data.first_name as string | null,
        last_name: data.last_name as string | null,
        email: data.email as string | null,
      }),
      location,
      ordersLabel: `${ordersCount} order${ordersCount === 1 ? "" : "s"}`,
      amountSpentLabel: formatCurrency(amountSpentCents),
    };
  });

  return (
    <AdminShell title="Customers" current="customers">
      <Card className="border-neutral-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>
            All customers captured from checkout orders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead className="text-right">Amount spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-neutral-900">
                      <Link
                        href={`/admin/customers/${row.id}`}
                        className="text-neutral-900 hover:underline"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>{row.location}</TableCell>
                    <TableCell>{row.ordersLabel}</TableCell>
                    <TableCell className="text-right">
                      {row.amountSpentLabel}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
              No customers yet.
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
