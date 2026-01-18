import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarClock, DollarSign, Receipt, Scale } from "lucide-react";

import AdminShell from "@/app/admin/components/AdminShell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-config";

export const metadata = {
  title: "Dashboard",
};

const STATS = [
  { label: "Sessions", value: "1248", icon: DollarSign },
  { label: "Total sales", value: "$1,250", icon: Receipt },
  { label: "Orders", value: "1450", icon: Scale },
  { label: "Conversion rate", value: "3.28%", icon: CalendarClock },
];

export default async function AdminDashboardPage() {
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

  return (
    <AdminShell title="Dashboard" current="dashboard">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((card) => (
          <Card
            key={card.label}
            className="border-neutral-200 bg-white shadow-sm"
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <CardDescription className="text-xs uppercase tracking-[0.2em] text-neutral-400">
                {card.label}
              </CardDescription>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                <card.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-neutral-900">
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="border-neutral-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Activity</CardTitle>
            <span className="text-xs text-neutral-400">Last year</span>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 text-sm text-neutral-400">
              Chart placeholder
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="border-none bg-neutral-900 text-white shadow-sm">
            <CardHeader>
              <CardDescription className="text-xs uppercase tracking-[0.2em] text-neutral-400">
                Upcoming obligations
              </CardDescription>
              <CardTitle className="text-lg text-white">
                VAT declaration
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-neutral-300">
              You have 27 days to submit the documentation.
            </CardContent>
          </Card>

          <Card className="border-neutral-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Agenda</CardTitle>
              <span className="text-xs text-neutral-400">Apr</span>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 text-center text-xs text-neutral-400">
                {"SMTWTFS".split("").map((day, index) => (
                  <div key={`${day}-${index}`} className="text-[10px] uppercase">
                    {day}
                  </div>
                ))}
                {Array.from({ length: 28 }).map((_, index) => {
                  const isActive = index === 9;
                  return (
                    <div
                      key={index}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] ${
                        isActive
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-600"
                      }`}
                    >
                      {index + 1}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="border-neutral-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Top selling products</CardTitle>
            <span className="text-xs text-neutral-400">Last contact</span>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {[
              { name: "Arquetipo", value: "2 days" },
              { name: "Everis", value: "4 days" },
              { name: "Cecotec", value: "1 week" },
            ].map((row) => (
              <div
                key={row.name}
                className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3"
              >
                <span className="font-medium text-neutral-800">
                  {row.name}
                </span>
                <span className="text-xs text-neutral-500">{row.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-neutral-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Monthly billing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <div className="flex h-32 w-32 items-center justify-center rounded-full border-[10px] border-neutral-200 text-center">
                <span className="text-sm font-semibold text-neutral-900">
                  $1,450
                </span>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-4 text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-neutral-900" />
                Charged
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-neutral-300" />
                Pending
              </span>
            </div>
          </CardContent>
        </Card>
      </section>
    </AdminShell>
  );
}
