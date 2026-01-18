"use client";

import { useMemo, useState } from "react";

import AdminShell from "@/app/admin/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

type DiscountItem = {
  id: number;
  code: string;
  discount_type: "fixed" | "percent";
  amount_cents: number | null;
  percent_off: number | null;
  active: boolean;
  usage_count: number;
};

type DiscountsClientProps = {
  discounts: DiscountItem[];
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export default function DiscountsClient({ discounts }: DiscountsClientProps) {
  const [items, setItems] = useState<DiscountItem[]>(discounts);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const isValid = useMemo(
    () => Boolean(code.trim() && amount.trim()),
    [code, amount],
  );

  async function handleCreate() {
    if (!isValid || loading) return;
    setError("");
    setActionError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          amount: amount.trim(),
          type: discountType,
          percent: discountType === "percent" ? amount.trim() : null,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || "Impossible de creer le code promo.");
        setLoading(false);
        return;
      }

      if (data?.discount) {
        setItems((prev) => [data.discount as DiscountItem, ...prev]);
      }
      setCode("");
      setDiscountType("fixed");
      setAmount("");
      setOpen(false);
    } catch {
      setError("Impossible de creer le code promo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(id: number, nextActive: boolean) {
    if (actionId) return;
    setActionError("");
    setActionId(id);
    try {
      const response = await fetch(`/api/admin/discounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setActionError(data?.error || "Failed to update discount.");
        setActionId(null);
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, active: nextActive } : item,
        ),
      );
    } catch {
      setActionError("Failed to update discount.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setError("");
          setCode("");
          setDiscountType("fixed");
          setAmount("");
        }
      }}
    >
      <AdminShell
        title="Discounts"
        current="discounts"
        action={
          <DialogTrigger asChild>
            <Button size="sm">Create discount code</Button>
          </DialogTrigger>
        }
      >
        <Card className="border-neutral-200 bg-white shadow-sm">
          <CardContent className="p-0">
            {actionError ? (
              <p className="px-6 pt-4 text-sm text-red-600">{actionError}</p>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-neutral-500"
                    >
                      No discount codes yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((discount) => (
                    <TableRow key={discount.id}>
                      <TableCell className="font-medium text-neutral-900">
                        {discount.code}
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {discount.discount_type === "percent"
                          ? `${discount.percent_off ?? 0}%`
                          : formatCurrency(discount.amount_cents ?? 0)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={discount.active ? "success" : "muted"}
                        >
                          {discount.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {discount.usage_count}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={discount.active}
                          onCheckedChange={(checked) =>
                            handleToggleActive(discount.id, checked)
                          }
                          disabled={actionId === discount.id}
                          aria-label={`Toggle ${discount.code}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </AdminShell>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create discount code</DialogTitle>
          <DialogDescription>
            Create a fixed amount discount for orders.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="discount-code"
              className="text-sm font-medium text-neutral-700"
            >
              Discount code
            </label>
            <Input
              id="discount-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="SUMMER10"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="discount-type"
              className="text-sm font-medium text-neutral-700"
            >
              Discount type
            </label>
            <select
              id="discount-type"
              value={discountType}
              onChange={(event) =>
                setDiscountType(event.target.value === "percent" ? "percent" : "fixed")
              }
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="fixed">Fixed amount</option>
              <option value="percent">Percentage</option>
            </select>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="discount-amount"
              className="text-sm font-medium text-neutral-700"
            >
              {discountType === "percent"
                ? "Percent off"
                : "Amount off (EUR)"}
            </label>
            <Input
              id="discount-amount"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={discountType === "percent" ? "10" : "10"}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!isValid || loading}
            >
              {loading ? "Saving..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
