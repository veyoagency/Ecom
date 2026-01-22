"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type OrderRefundDialogProps = {
  orderId: number;
  totalCents: number;
  refundedCents?: number | null;
  paymentStatus?: string | null;
  orderStatus?: string | null;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function normalizeAmountInput(value: string) {
  return value.replace(",", ".").trim();
}

export default function OrderRefundDialog({
  orderId,
  totalCents,
  refundedCents,
  paymentStatus,
  orderStatus,
}: OrderRefundDialogProps) {
  const router = useRouter();
  const refunded = Math.max(Number(refundedCents ?? 0), 0);
  const remainingCents = Math.max(totalCents - refunded, 0);
  const [open, setOpen] = useState(false);
  const [amountInput, setAmountInput] = useState(
    (remainingCents / 100).toFixed(2),
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmountInput((remainingCents / 100).toFixed(2));
      setErrorMessage(null);
    }
  }, [open, remainingCents]);

  const amountCents = useMemo(() => {
    const normalized = normalizeAmountInput(amountInput);
    if (!normalized) return 0;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(parsed * 100);
  }, [amountInput]);

  const isPaidStatus =
    orderStatus === "paid" || orderStatus === "fulfilled" || orderStatus == null;
  const isRefundable =
    remainingCents > 0 &&
    isPaidStatus &&
    (paymentStatus === "paid" ||
      paymentStatus === "partially_refunded" ||
      paymentStatus == null);

  const isAmountValid = amountCents > 0 && amountCents <= remainingCents;

  const handleRefund = async () => {
    if (!isRefundable || !isAmountValid) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(String(orderId))}/refund`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountCents }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setErrorMessage(payload?.error || "Remboursement impossible.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setErrorMessage("Remboursement impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!isRefundable}>
          Refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund order</DialogTitle>
          <DialogDescription>
            Choose the amount to refund. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2 text-sm text-neutral-600">
            <div className="flex items-center justify-between">
              <span>Paid</span>
              <span className="text-neutral-900">
                {formatCurrency(totalCents)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Already refunded</span>
              <span className="text-neutral-900">
                {formatCurrency(refunded)}
              </span>
            </div>
            <div className="flex items-center justify-between font-medium text-neutral-900">
              <span>Remaining</span>
              <span>{formatCurrency(remainingCents)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase text-neutral-400">
              Refund amount (EUR)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              className="w-full border border-neutral-200 px-3 py-2 text-sm"
            />
            {!isAmountValid ? (
              <p className="text-xs text-amber-600">
                The refund must be greater than 0 and up to{" "}
                {formatCurrency(remainingCents)}.
              </p>
            ) : null}
            {errorMessage ? (
              <p className="text-xs text-red-600">{errorMessage}</p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleRefund} disabled={!isAmountValid || submitting}>
            {submitting ? "Refunding..." : "Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
