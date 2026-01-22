"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ShippingLabelItem = {
  id: number;
  title: string;
  qty: number;
  unitPriceCents: number;
  imageUrl?: string | null;
  weightKg: string | null;
};

type ShippingAddress = {
  name: string;
  address1: string;
  address2: string;
  postalCode: string;
  city: string;
  country: string;
};

type QuoteOption = {
  code: string;
  name: string;
  carrierName: string | null;
  price: { value: string; currency: string } | null;
  leadTime: number | null;
  lastMile: string | null;
  requiresServicePoint: boolean;
};

type CreateShippingLabelDialogProps = {
  orderPublicId: string;
  orderNumber: string;
  orderDateLabel: string;
  shippingTitle: string;
  shippingCarrier: string | null;
  shippingType: string | null;
  shippingCents: number;
  address: ShippingAddress;
  items: ShippingLabelItem[];
};

type ItemWeightInput = {
  id: number;
  value: string;
  unit: "g" | "kg";
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function parseWeightKg(value: string | null) {
  if (!value) return null;
  const normalized = value.replace(",", ".");
  const weight = Number(normalized);
  if (!Number.isFinite(weight)) return null;
  return weight;
}

function parseNumberInput(value: string) {
  if (!value) return null;
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function weightInputToKg(weight: ItemWeightInput) {
  const parsed = parseNumberInput(weight.value);
  if (parsed === null) return 0;
  return weight.unit === "g" ? parsed / 1000 : parsed;
}

export default function CreateShippingLabelDialog({
  orderPublicId,
  orderNumber,
  orderDateLabel,
  shippingTitle,
  shippingCarrier,
  shippingType,
  shippingCents,
  address,
  items,
}: CreateShippingLabelDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [labelCreating, setLabelCreating] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const [labelTracking, setLabelTracking] = useState<{
    number: string | null;
    url: string | null;
  }>({ number: null, url: null });
  const [manualTotalWeightDraft, setManualTotalWeightDraft] = useState("");
  const [manualTotalWeightCommitted, setManualTotalWeightCommitted] = useState<
    string | null
  >(null);
  const [useManualTotalWeight, setUseManualTotalWeight] = useState(false);
  const [weightDrafts, setWeightDrafts] = useState<ItemWeightInput[]>(() =>
    items.map((item) => {
      const weightKg = parseWeightKg(item.weightKg);
      const grams =
        weightKg !== null ? Math.round(weightKg * 1000 * 1000) / 1000 : null;
      return {
        id: item.id,
        value: grams !== null ? String(grams) : "",
        unit: "g",
      };
    }),
  );
  const [weightCommitted, setWeightCommitted] = useState<ItemWeightInput[]>(() =>
    items.map((item) => {
      const weightKg = parseWeightKg(item.weightKg);
      const grams =
        weightKg !== null ? Math.round(weightKg * 1000 * 1000) / 1000 : null;
      return {
        id: item.id,
        value: grams !== null ? String(grams) : "",
        unit: "g",
      };
    }),
  );
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([]);
  const [selectedQuoteCode, setSelectedQuoteCode] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const normalizedShippingType = shippingType?.toLowerCase() ?? "";

  const isOtherCarrier =
    !shippingCarrier ||
    shippingCarrier.toLowerCase() === "other" ||
    shippingCarrier.toLowerCase() === "autre";

  const autoTotalWeightKg = useMemo(() => {
    return items.reduce((total, item) => {
      const weight = weightCommitted.find((entry) => entry.id === item.id);
      const perUnitKg = weight ? weightInputToKg(weight) : 0;
      return total + perUnitKg * item.qty;
    }, 0);
  }, [items, weightCommitted]);

  const totalWeightKg = useMemo(() => {
    if (useManualTotalWeight) {
      const parsed = parseNumberInput(manualTotalWeightCommitted ?? "");
      return parsed ?? autoTotalWeightKg;
    }
    return autoTotalWeightKg;
  }, [autoTotalWeightKg, manualTotalWeightCommitted, useManualTotalWeight]);

  useEffect(() => {
    if (!open) return;
    if (isOtherCarrier) {
      setQuoteOptions([]);
      setQuoteError(null);
      setQuoteLoading(false);
      setSelectedQuoteCode(null);
      return;
    }
    if (!address.postalCode || !address.country || totalWeightKg <= 0) {
      setQuoteOptions([]);
      setQuoteError("Missing shipping address or weight.");
      setSelectedQuoteCode(null);
      return;
    }
    let active = true;
    const loadQuote = async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const response = await fetch("/api/admin/shipping/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toCountryCode: address.country,
            toPostalCode: address.postalCode,
            carrierCode: shippingCarrier,
            totalWeightKg,
          }),
        });
        const data = (await response.json().catch(() => null)) as
          | { options?: QuoteOption[]; error?: string }
          | null;
        if (!response.ok) {
          if (active) {
            setQuoteError(data?.error || "Failed to load quote.");
          }
          return;
        }
        if (active) {
          setQuoteOptions(Array.isArray(data?.options) ? data.options : []);
        }
      } catch {
        if (active) {
          setQuoteError("Failed to load quote.");
        }
      } finally {
        if (active) {
          setQuoteLoading(false);
        }
      }
    };
    void loadQuote();
    return () => {
      active = false;
    };
  }, [
    open,
    address.country,
    address.postalCode,
    isOtherCarrier,
    shippingCarrier,
    totalWeightKg,
  ]);

  useEffect(() => {
    if (!open) return;
    setUseManualTotalWeight(false);
    setManualTotalWeightDraft("");
    setManualTotalWeightCommitted(null);
    setLabelCreating(false);
    setLabelError(null);
    setLabelUrl(null);
    setLabelTracking({ number: null, url: null });
  }, [open]);

  const handleCreateLabel = async () => {
    if (!selectedQuoteCode) {
      setLabelError("Select a shipping service.");
      return;
    }
    if (!orderPublicId) {
      setLabelError("Order is missing.");
      return;
    }

    setLabelCreating(true);
    setLabelError(null);
    setLabelUrl(null);
    setLabelTracking({ number: null, url: null });

    try {
      const response = await fetch("/api/admin/shipping/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderPublicId,
          shippingOptionCode: selectedQuoteCode,
          totalWeightKg,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            shipmentId?: string;
            parcelId?: number;
            labelUrl?: string;
            trackingNumber?: string;
            trackingUrl?: string;
            error?: string;
          }
        | null;
      if (!response.ok) {
        setLabelError(data?.error || "Failed to create shipping label.");
        return;
      }
      router.refresh();
      setLabelUrl(data?.labelUrl ?? null);
      setLabelTracking({
        number: data?.trackingNumber ?? null,
        url: data?.trackingUrl ?? null,
      });
    } catch {
      setLabelError("Failed to create shipping label.");
    } finally {
      setLabelCreating(false);
    }
  };

  const filteredQuoteOptions = useMemo(() => {
    if (!quoteOptions.length) return [];
    if (normalizedShippingType === "service_points") {
      return quoteOptions.filter(
        (option) => option.lastMile === "service_point" || option.requiresServicePoint,
      );
    }
    if (normalizedShippingType === "shipping") {
      return quoteOptions.filter(
        (option) =>
          option.lastMile !== "service_point" && !option.requiresServicePoint,
      );
    }
    return quoteOptions;
  }, [normalizedShippingType, quoteOptions]);

  const sortedQuoteOptions = useMemo(() => {
    if (!filteredQuoteOptions.length) return [];
    return filteredQuoteOptions
      .map((option) => ({
        option,
        price: parseNumberInput(option.price?.value ?? ""),
      }))
      .sort((a, b) => {
        if (a.price === null && b.price === null) return 0;
        if (a.price === null) return 1;
        if (b.price === null) return -1;
        return a.price - b.price;
      })
      .map((entry) => entry.option);
  }, [filteredQuoteOptions]);

  const selectedQuote = useMemo(() => {
    if (!selectedQuoteCode) return null;
    return (
      sortedQuoteOptions.find((option) => option.code === selectedQuoteCode) ??
      null
    );
  }, [selectedQuoteCode, sortedQuoteOptions]);
  const selectedQuotePriceCents = useMemo(() => {
    const value = selectedQuote?.price?.value ?? "";
    const parsed = parseNumberInput(value);
    if (parsed === null) return null;
    return Math.round(parsed * 100);
  }, [selectedQuote]);
  const labelSubtotalCents = selectedQuotePriceCents ?? shippingCents;
  const labelDownloadUrl = labelUrl
    ? `/api/admin/shipping/labels/download?url=${encodeURIComponent(labelUrl)}`
    : null;

  useEffect(() => {
    if (!labelDownloadUrl) return;
    const link = document.createElement("a");
    link.href = labelDownloadUrl;
    link.download = "label.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    const timer = window.setTimeout(() => {
      setOpen(false);
    }, 150);
    return () => {
      window.clearTimeout(timer);
    };
  }, [labelDownloadUrl]);

  useEffect(() => {
    if (!sortedQuoteOptions.length) {
      setSelectedQuoteCode(null);
      return;
    }
    setSelectedQuoteCode(sortedQuoteOptions[0].code);
  }, [sortedQuoteOptions]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-black text-white hover:bg-black/90">
          Create shipping label
        </Button>
      </DialogTrigger>
      <DialogContent className="min-w-fit max-h-[90vh] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create shipping label</DialogTitle>
          <p className="text-xs text-neutral-500">
            Order {orderNumber} • {orderDateLabel}
          </p>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-medium text-neutral-900">
                Shipping address
              </h3>
              <div className="mt-3 space-y-1 text-sm text-neutral-700">
                <p>{address.name || "-"}</p>
                <p>{address.address1}</p>
                {address.address2 ? <p>{address.address2}</p> : null}
                <p>
                  {address.city}, {address.postalCode}, {address.country}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-medium text-neutral-900">Items</h3>
              <div className="mt-3 overflow-hidden rounded-md border border-neutral-200">
                <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-500">
                  <span>Product</span>
                  <span>Quantity</span>
                  <span>Weight (per unit)</span>
                </div>
                <div className="divide-y divide-neutral-200">
                  {items.map((item) => {
                    const draft = weightDrafts.find((entry) => entry.id === item.id);
                    const committed = weightCommitted.find(
                      (entry) => entry.id === item.id,
                    );
                    return (
                      <div
                        key={item.id}
                        className="grid grid-cols-[2fr_1fr_1fr] items-center gap-4 px-4 py-3 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-neutral-900">
                              {item.title}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm text-neutral-700">
                          {item.qty}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            className="h-9 w-full rounded-md border border-neutral-200 px-2 text-sm"
                            value={draft?.value ?? ""}
                            onChange={(event) =>
                              setWeightDrafts((prev) =>
                                prev.map((entry) =>
                                  entry.id === item.id
                                    ? { ...entry, value: event.target.value }
                                    : entry,
                                ),
                              )
                            }
                            onBlur={() => {
                              if (!draft) return;
                              setWeightCommitted((prev) =>
                                prev.map((entry) =>
                                  entry.id === item.id ? { ...draft } : entry,
                                ),
                              );
                            }}
                          />
                          <select
                            className="h-9 rounded-md border border-neutral-200 px-2 text-sm"
                            value={draft?.unit ?? "g"}
                            onChange={(event) => {
                              const nextUnit = event.target.value as "g" | "kg";
                              const value = draft?.value ?? committed?.value ?? "";
                              const parsed = parseNumberInput(value);
                              const converted =
                                parsed === null
                                  ? ""
                                  : nextUnit === "kg"
                                    ? (draft?.unit ?? "g") === "g"
                                      ? (parsed / 1000).toFixed(3)
                                      : parsed.toString()
                                    : (draft?.unit ?? "g") === "kg"
                                      ? Math.round(parsed * 1000).toString()
                                      : parsed.toString();
                              const next: ItemWeightInput = {
                                id: item.id,
                                value: converted,
                                unit: nextUnit,
                              };
                              setWeightDrafts((prev) =>
                                prev.map((entry) =>
                                  entry.id === item.id ? next : entry,
                                ),
                              );
                              setWeightCommitted((prev) =>
                                prev.map((entry) =>
                                  entry.id === item.id ? next : entry,
                                ),
                              );
                            }}
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-medium text-neutral-900">Total weight</h3>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-neutral-500">
                  Total weight (with package)
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
                    value={
                      useManualTotalWeight
                        ? manualTotalWeightDraft
                        : autoTotalWeightKg.toFixed(3)
                    }
                    onChange={(event) => {
                      setManualTotalWeightDraft(event.target.value);
                      setUseManualTotalWeight(true);
                    }}
                    onBlur={() => {
                      if (!manualTotalWeightDraft.trim()) {
                        setUseManualTotalWeight(false);
                        setManualTotalWeightCommitted(null);
                        return;
                      }
                      setManualTotalWeightCommitted(manualTotalWeightDraft);
                    }}
                  />
                  <select
                    className="h-10 rounded-md border border-neutral-200 px-2 text-sm"
                    value="kg"
                    disabled
                  >
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-medium text-neutral-900">
                Shipping service
              </h3>
              <div className="mt-3 space-y-3 text-sm text-neutral-700">
                <div className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2 text-sm">
                  <span>Selected by customer</span>
                  <span>
                    {shippingTitle || "Standard"} • {formatCurrency(shippingCents)}
                  </span>
                </div>
                {isOtherCarrier ? (
                  <p className="text-xs text-neutral-500">
                    Quotes are not available for the selected carrier.
                  </p>
                ) : quoteLoading ? (
                  <p className="text-xs text-neutral-500">Loading quote...</p>
                ) : quoteError ? (
                  <p className="text-xs text-red-600">{quoteError}</p>
                ) : sortedQuoteOptions.length === 0 ? (
                  <p className="text-xs text-neutral-500">
                    No quotes available.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sortedQuoteOptions.map((option, index) => (
                      <label
                        key={option.code}
                        className={`flex cursor-pointer items-start justify-between gap-4 rounded-md border px-3 py-3 ${
                          selectedQuoteCode === option.code
                            ? "border-blue-600 bg-blue-50"
                            : "border-neutral-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="shipping-quote"
                            checked={selectedQuoteCode === option.code}
                            onChange={() => setSelectedQuoteCode(option.code)}
                          />
                          <div>
                            <p className="text-sm font-medium text-neutral-900">
                              {option.name}
                            </p>
                            {option.carrierName ? (
                              <p className="text-xs text-neutral-500">
                                {option.carrierName}
                              </p>
                            ) : null}
                            {option.leadTime !== null ? (
                              <p className="mt-2 text-xs text-neutral-500">
                                {option.leadTime} business hours
                              </p>
                            ) : null}
                            {index === 0 ? (
                              <div className="mt-2 flex gap-2">
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                                  Suggested
                                </span>
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                                  Cheapest
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <span className="text-sm font-medium">
                          {option.price
                            ? `${option.price.value} ${option.price.currency}`
                            : "-"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-medium text-neutral-900">Summary</h3>
              <div className="mt-3 space-y-3 text-sm text-neutral-600">
                <div className="flex items-center justify-between">
                  <span>{selectedQuote?.name || shippingTitle || "Shipping"}</span>
                  <span>{formatCurrency(labelSubtotalCents)}</span>
                </div>
              </div>
              <Button
                type="button"
                className="mt-4 w-full bg-black text-white hover:bg-black/90"
                disabled={
                  isOtherCarrier || quoteLoading || labelCreating || !selectedQuoteCode
                }
                onClick={handleCreateLabel}
              >
                {labelCreating ? "Creating label..." : "Buy shipping label"}
              </Button>
              {labelError ? (
                <p className="mt-2 text-xs text-red-600">{labelError}</p>
              ) : null}
              {labelDownloadUrl ? (
                <div className="mt-2 text-xs text-neutral-600">
                  <a
                    href={labelDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Download label
                  </a>
                  {labelTracking.url ? (
                    <span className="ml-2 text-neutral-500">
                      ·{" "}
                      <a
                        href={labelTracking.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-600 hover:underline"
                      >
                        Tracking
                      </a>
                    </span>
                  ) : labelTracking.number ? (
                    <span className="ml-2 text-neutral-500">
                      · {labelTracking.number}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
