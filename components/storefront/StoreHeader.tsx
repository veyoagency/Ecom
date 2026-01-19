"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, Minus, Plus, ShoppingBag, Tag, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useCart } from "@/components/storefront/cart-context";

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: Record<string, unknown>) => {
        isEligible: () => boolean;
        render: (container: HTMLElement) => Promise<void>;
        close?: () => void;
      };
    };
  }
}

function formatPrice(cents: number) {
  const value = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `${value.replace(/\u00a0|\u202f/g, " ")}€`;
}

function PayPalCheckoutButton({
  clientId,
  amountCents,
  items,
  discountCode,
  onPaid,
}: {
  clientId?: string;
  amountCents: number;
  items: Array<{ id: number; quantity: number }>;
  discountCode?: string | null;
  onPaid: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clientId) {
      setReady(false);
      return;
    }
    if (window.paypal) {
      setReady(true);
      return;
    }
    const scriptId = "paypal-sdk-js";
    const existing = document.getElementById(scriptId) as
      | HTMLScriptElement
      | null;
    if (existing) {
      existing.addEventListener("load", () => setReady(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR&intent=capture&disable-funding=card&components=buttons`;
    script.async = true;
    script.onload = () => setReady(true);
    script.onerror = () => setReady(false);
    document.body.appendChild(script);
  }, [clientId]);

  useEffect(() => {
    if (
      !ready ||
      !containerRef.current ||
      !clientId ||
      amountCents <= 0 ||
      items.length === 0
    ) {
      setEligible(false);
      return;
    }
    const paypal = window.paypal;
    if (!paypal) {
      setEligible(false);
      return;
    }

    containerRef.current.innerHTML = "";
    const buttons = paypal.Buttons({
      style: {
        layout: "vertical",
        shape: "rect",
        color: "gold",
        label: "paypal",
      },
      createOrder: async () => {
        setErrorMessage(null);
        const response = await fetch("/api/paypal/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((item) => ({
              product_id: item.id,
              qty: item.quantity,
            })),
            discountCode: discountCode ?? null,
          }),
        });
        const data = (await response.json()) as { orderId?: string; error?: string };
        if (!response.ok || !data.orderId) {
          setErrorMessage(data?.error || "Erreur PayPal.");
          throw new Error(data?.error || "PayPal order creation failed.");
        }
        return data.orderId;
      },
      onApprove: async (
        data: { orderID?: string },
      ) => {
        if (!data?.orderID) {
          setErrorMessage("Commande PayPal invalide.");
          return;
        }
        const response = await fetch("/api/paypal/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: data.orderID,
            items: items.map((item) => ({
              product_id: item.id,
              qty: item.quantity,
            })),
            discountCode: discountCode ?? null,
          }),
        });
        const payload = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          setErrorMessage(payload?.error || "Paiement invalide.");
          return;
        }
        onPaid();
      },
      onError: () => {
        setErrorMessage("Erreur PayPal.");
        setEligible(false);
      },
    });

    if (!buttons.isEligible()) {
      setEligible(false);
      return;
    }

    setEligible(true);
    buttons.render(containerRef.current);

    return () => {
      buttons.close?.();
    };
  }, [amountCents, clientId, discountCode, items, onPaid, ready]);

  if (!clientId || amountCents <= 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <div className={`${eligible ? "" : "hidden"}`.trim()} ref={containerRef} />
      {errorMessage ? (
        <p className="mt-2 text-xs text-red-600">{errorMessage}</p>
      ) : null}
    </div>
  );
}

export default function StoreHeader({
  transparent = false,
  fontClassName = "",
  logoUrl = null,
  storeName = "New Commerce",
  paypalClientId,
}: {
  transparent?: boolean;
  fontClassName?: string;
  logoUrl?: string | null;
  storeName?: string;
  paypalClientId?: string;
}) {
  const {
    items,
    totalCents,
    incrementItem,
    decrementItem,
    removeItem,
    discount,
    discountCents,
    estimatedTotalCents,
    setDiscount,
    clear,
  } = useCart();
  const hasItems = items.length > 0;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const iconClassName = transparent ? "text-white" : "text-neutral-900";
  const sheetClassName = `${fontClassName} bg-white`.trim();
  const [discountInput, setDiscountInput] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);

  const handleApplyDiscount = async () => {
    const code = discountInput.trim().toUpperCase();
    if (!code || totalCents <= 0) {
      return;
    }
    setDiscountError(null);
    setDiscountLoading(true);
    try {
      const response = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotalCents: totalCents }),
      });
      const data = (await response.json()) as {
        valid?: boolean;
        error?: string;
        discount?: {
          code: string;
          discount_type: "fixed" | "percent";
          amount_cents: number | null;
          percent_off: number | null;
        };
      };
      if (!response.ok || !data.valid || !data.discount) {
        setDiscount(null);
        setDiscountError(data.error || "Code invalide.");
        return;
      }
      setDiscount({
        code: data.discount.code,
        discountType: data.discount.discount_type,
        amountCents: data.discount.amount_cents,
        percentOff: data.discount.percent_off,
      });
      setDiscountInput("");
    } catch {
      setDiscount(null);
      setDiscountError("Impossible de verifier le code.");
    } finally {
      setDiscountLoading(false);
    }
  };

  return (
    <header
      className={
        transparent
          ? "absolute inset-x-0 top-0 z-20 bg-transparent text-white"
          : "bg-white"
      }
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
        <div className="grid w-full grid-cols-3 items-center">
          <div className="flex h-full items-center justify-start">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open menu"
                  className="cursor-pointer hover:bg-transparent"
                >
                  <Menu className={`h-5 w-5 ${iconClassName}`} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className={sheetClassName}>
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                  <SheetDescription>
                    Browse the storefront sections.
                  </SheetDescription>
                </SheetHeader>
                <nav className="mt-4 flex flex-col gap-2 px-4">
                  <Link
                    href="/"
                    className="rounded-md px-3 py-2 text-base font-normal text-neutral-700 hover:bg-neutral-100"
                  >
                    Home
                  </Link>
                  <Link
                    href="/produits"
                    className="rounded-md px-3 py-2 text-base font-normal text-neutral-700 hover:bg-neutral-100"
                  >
                    Produits
                  </Link>
                  <Link
                    href="/panier"
                    className="rounded-md px-3 py-2 text-base font-normal text-neutral-700 hover:bg-neutral-100"
                  >
                    Panier
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex h-full items-center justify-center">
            <Link
              href="/"
              className={`text-base font-normal uppercase leading-none ${
                transparent ? "text-white" : "text-neutral-900"
              }`}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={storeName}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                storeName
              )}
            </Link>
          </div>
          <div className="flex h-full items-center justify-end">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open cart"
                  className="cursor-pointer hover:bg-transparent"
                >
                  <ShoppingBag className={`h-5 w-5 ${iconClassName}`} />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className={sheetClassName}>
                <SheetHeader className="flex flex-row items-center gap-2 px-4 pb-2 pt-4">
                  <SheetTitle className="text-base font-normal text-neutral-900">
                    Panier
                  </SheetTitle>
                  <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600">
                    {totalQuantity}
                  </span>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-6 px-4 pb-6">
                  {hasItems ? (
                    <div className="flex flex-col gap-6">
                      {items.map((item) => {
                        const key = `${item.id}-${item.variantLabel ?? "default"}`;
                        const lineTotal = item.priceCents * item.quantity;
                        return (
                          <div key={key} className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="h-16 w-16 overflow-hidden bg-neutral-100">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : null}
                              </div>
                              <div className="flex flex-1 flex-col gap-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm text-neutral-900">
                                    {item.title}
                                  </span>
                                  <span className="text-sm text-neutral-900">
                                    {formatPrice(lineTotal)}
                                  </span>
                                </div>
                                {item.variantLabel ? (
                                  <span className="text-xs text-neutral-500">
                                    {item.variantLabel}
                                  </span>
                                ) : null}
                                <span className="text-xs text-neutral-500">
                                  {formatPrice(item.priceCents)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center border border-neutral-300">
                                <button
                                  type="button"
                                  onClick={() =>
                                    decrementItem(item.id, item.variantLabel)
                                  }
                                  className="px-3 py-2 text-neutral-700"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="min-w-[36px] text-center text-sm text-neutral-900">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    incrementItem(item.id, item.variantLabel)
                                  }
                                  className="px-3 py-2 text-neutral-700"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  removeItem(item.id, item.variantLabel)
                                }
                                className="text-neutral-500"
                                aria-label="Remove item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
                      Your cart is empty.
                    </div>
                  )}
                  {hasItems ? (
                    <div className="mt-auto flex flex-col gap-4 border-t border-neutral-200 pt-4">
                      {discount && discountCents > 0 ? (
                        <div className="space-y-2 border-b border-neutral-200 pb-4 text-sm text-neutral-700">
                          <div className="flex items-center justify-between">
                            <span>Sous-total</span>
                            <span className="text-neutral-900">
                              {formatPrice(totalCents)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-neutral-600">
                            <div className="flex items-center gap-2">
                              <Tag className="h-3.5 w-3.5" />
                              <span className="uppercase">{discount.code}</span>
                            </div>
                            <span className="text-neutral-900">
                              -{formatPrice(discountCents)}
                            </span>
                          </div>
                        </div>
                      ) : null}
                      <Accordion
                        type="single"
                        collapsible
                        className="border-b border-neutral-200"
                      >
                        <AccordionItem
                          value="reduction"
                          className="border-neutral-200"
                        >
                          <AccordionTrigger className="group py-3 text-sm font-normal text-neutral-700 hover:no-underline [&>svg]:hidden">
                            <span className="flex w-full items-center justify-between">
                              <span>Reduction</span>
                              <span className="flex items-center">
                                <Plus className="h-4 w-4 text-neutral-500 group-data-[state=open]:hidden" />
                                <Minus className="hidden h-4 w-4 text-neutral-500 group-data-[state=open]:inline" />
                              </span>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={discountInput}
                                onChange={(event) => {
                                  setDiscountInput(event.target.value);
                                  if (discountError) {
                                    setDiscountError(null);
                                  }
                                }}
                                placeholder="Code de reduction"
                                className="h-10 flex-1 border border-neutral-300 px-3 text-sm"
                              />
                              <Button
                                className="h-10 rounded-none bg-black text-white hover:bg-black/90"
                                onClick={handleApplyDiscount}
                                disabled={discountLoading || !discountInput.trim()}
                              >
                                Appliquer
                              </Button>
                            </div>
                            {discountError ? (
                              <p className="mt-2 text-xs text-red-600">
                                {discountError}
                              </p>
                            ) : null}
                            {discount ? (
                              <div className="mt-3 flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-1 text-xs uppercase text-neutral-700">
                                  {discount.code}
                                  <button
                                    type="button"
                                    onClick={() => setDiscount(null)}
                                    className="text-neutral-500"
                                    aria-label="Remove discount"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              </div>
                            ) : null}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                      <div className="flex items-center justify-between text-sm text-neutral-700">
                        <span>Total estime</span>
                        <span className="text-neutral-900">
                          {formatPrice(estimatedTotalCents)}
                        </span>
                      </div>
                      <Button
                        asChild
                        className="py-6 rounded-none bg-black text-white hover:bg-black/90"
                      >
                        <Link href="/checkout">Payer</Link>
                      </Button>
                      <PayPalCheckoutButton
                        clientId={paypalClientId}
                        amountCents={estimatedTotalCents}
                        items={items.map((item) => ({
                          id: item.id,
                          quantity: item.quantity,
                        }))}
                        discountCode={discount?.code ?? null}
                        onPaid={clear}
                      />
                    </div>
                  ) : null}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
