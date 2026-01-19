"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type RiskDetails = {
  score: number | null;
  level: string | null;
  sellerMessage: string | null;
  reason: string | null;
  rule: string | null;
  outcomeType: string | null;
  networkStatus: string | null;
  chargeId: string | null;
  paymentIntentId: string | null;
};

function normalizeLevel(value: string | null) {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized === "highest") return "high";
  if (normalized === "elevated") return "elevated";
  if (normalized === "normal") return "normal";
  if (normalized === "not_assessed") return "unknown";
  return "unknown";
}

function formatRiskLabel(level: string) {
  if (level === "high") return "High";
  if (level === "elevated") return "Elevated";
  if (level === "normal") return "Normal";
  return "Unknown";
}

function getRiskColor(level: string) {
  if (level === "high") return "bg-red-500";
  if (level === "elevated") return "bg-amber-500";
  if (level === "normal") return "bg-emerald-500";
  return "bg-neutral-400";
}

function getRiskMessage(level: string) {
  if (level === "high") {
    return "Chargeback risk is high. Review this order before fulfilling.";
  }
  if (level === "elevated") {
    return "Chargeback risk is elevated. Consider reviewing the order.";
  }
  if (level === "normal") {
    return "Chargeback risk is normal. You can fulfill this order.";
  }
  return "Risk data is not available yet.";
}

function getRiskBarWidth(level: string) {
  if (level === "high") return 100;
  if (level === "elevated") return 66;
  if (level === "normal") return 33;
  return 0;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-xs font-medium text-neutral-800">{value}</span>
    </div>
  );
}

export default function OrderRiskCard({ risk }: { risk: RiskDetails }) {
  const level = normalizeLevel(risk.level);
  const label = formatRiskLabel(level);
  const barWidth = getRiskBarWidth(level);
  const barClass = getRiskColor(level);
  const message = getRiskMessage(level);
  const showNotAssessed = level === "unknown";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">Order risk</p>
          <p className="text-xs text-neutral-500">Stripe Radar</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
              About this order
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Order risk details</DialogTitle>
              <DialogDescription>
                Radar outcome for this payment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <DetailRow label="Risk level" value={label} />
              <DetailRow
                label="Risk score"
                value={risk.score !== null ? String(risk.score) : "N/A"}
              />
              <DetailRow
                label="Seller message"
                value={risk.sellerMessage || "N/A"}
              />
              <DetailRow label="Outcome type" value={risk.outcomeType || "N/A"} />
              <DetailRow label="Network status" value={risk.networkStatus || "N/A"} />
              <DetailRow label="Reason" value={risk.reason || "N/A"} />
              <DetailRow label="Rule" value={risk.rule || "N/A"} />
              <DetailRow label="Payment intent" value={risk.paymentIntentId || "N/A"} />
              <DetailRow label="Charge" value={risk.chargeId || "N/A"} />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4">
        <div className="h-2 w-full rounded-full bg-neutral-200">
          <div
            className={`h-full rounded-full ${barClass}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-medium">
          <span
            className={level === "normal" ? "text-emerald-700" : "text-neutral-500"}
          >
            Normal
          </span>
          <span
            className={level === "elevated" ? "text-amber-700" : "text-neutral-500"}
          >
            Elevated
          </span>
          <span className={level === "high" ? "text-red-700" : "text-neutral-500"}>
            High
          </span>
        </div>
        <p className="mt-3 text-sm text-neutral-600">{message}</p>
        {showNotAssessed ? (
          <p className="mt-1 text-xs text-neutral-500">
            Risk not assessed.
          </p>
        ) : null}
      </div>
    </div>
  );
}
