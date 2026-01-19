"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  HelpCircle,
  Lock,
  Search,
  ShoppingBag,
  Store,
  Truck,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import { useCart } from "@/components/storefront/cart-context";

type CheckoutClientProps = {
  fontClassName: string;
  storeName: string;
  logoUrl?: string | null;
  shippingCents: number;
  stripePublishableKey?: string | null;
};

type CustomerFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type ShippingFormState = {
  address1: string;
  address2: string;
  postalCode: string;
  city: string;
  country: string;
};

function formatPrice(cents: number) {
  const value = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `${value.replace(/\u00a0|\u202f/g, " ")} €`;
}

function calculateDiscountCents(baseCents: number, discount: {
  discountType: "fixed" | "percent";
  amountCents: number | null;
  percentOff: number | null;
} | null) {
  if (!discount || baseCents <= 0) return 0;
  let discountCents = 0;
  if (discount.discountType === "percent") {
    const percent = discount.percentOff ?? 0;
    discountCents = Math.round((baseCents * percent) / 100);
  } else {
    discountCents = discount.amountCents ?? 0;
  }
  return Math.min(Math.max(discountCents, 0), baseCents);
}

function StripePayButton({
  customer,
  shipping,
  itemsPayload,
  discountCode,
  paymentIntentId,
  onPaid,
  disabled,
}: {
  customer: CustomerFormState;
  shipping: ShippingFormState;
  itemsPayload: Array<{ product_id: number; qty: number }>;
  discountCode?: string | null;
  paymentIntentId?: string | null;
  onPaid: (orderPublicId: string) => void;
  disabled: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasRequiredFields =
    customer.firstName.trim() &&
    customer.lastName.trim() &&
    customer.email.trim() &&
    shipping.address1.trim() &&
    shipping.postalCode.trim() &&
    shipping.city.trim();

  const handleSubmit = async () => {
    if (!stripe || !elements) {
      return;
    }
    if (!hasRequiredFields) {
      setErrorMessage("Renseignez les informations de contact et de livraison.");
      return;
    }
    if (!itemsPayload.length) {
      setErrorMessage("Panier vide.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setErrorMessage(submitError.message ?? "Paiement invalide.");
      setSubmitting(false);
      return;
    }

    if (paymentIntentId) {
      const updateResponse = await fetch("/api/stripe/update-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId,
          checkoutUrl: window.location.href,
          customer: {
            name: `${customer.firstName} ${customer.lastName}`.trim(),
            email: customer.email,
            phone: customer.phone || null,
            address: {
              line1: shipping.address1 || null,
              line2: shipping.address2 || null,
              postal_code: shipping.postalCode || null,
              city: shipping.city || null,
              country: shipping.country || "FR",
            },
          },
          shipping: {
            name: `${customer.firstName} ${customer.lastName}`.trim(),
            phone: customer.phone || null,
            address: {
              line1: shipping.address1 || null,
              line2: shipping.address2 || null,
              postal_code: shipping.postalCode || null,
              city: shipping.city || null,
              country: shipping.country || "FR",
            },
          },
        }),
      });
      const updatePayload = (await updateResponse.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!updateResponse.ok) {
        setErrorMessage(updatePayload?.error || "Impossible de preparer le paiement.");
        setSubmitting(false);
        return;
      }
    }

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        receipt_email: customer.email,
        payment_method_data: {
          billing_details: {
            name: `${customer.firstName} ${customer.lastName}`.trim(),
            email: customer.email,
            phone: customer.phone || undefined,
            address: {
              line1: shipping.address1 || undefined,
              line2: shipping.address2 || undefined,
              postal_code: shipping.postalCode || undefined,
              city: shipping.city || undefined,
              country: shipping.country || "FR",
            },
          },
        },
        shipping: {
          name: `${customer.firstName} ${customer.lastName}`.trim(),
          phone: customer.phone || undefined,
          address: {
            line1: shipping.address1 || undefined,
            line2: shipping.address2 || undefined,
            postal_code: shipping.postalCode || undefined,
            city: shipping.city || undefined,
            country: shipping.country || "FR",
          },
        },
      },
    });

    if (result.error) {
      setErrorMessage(result.error.message ?? "Paiement refuse.");
      setSubmitting(false);
      return;
    }

    const paymentIntent = result.paymentIntent;
    if (!paymentIntent || paymentIntent.status !== "succeeded") {
      setErrorMessage("Paiement en attente de confirmation.");
      setSubmitting(false);
      return;
    }

    const response = await fetch("/api/stripe/confirm-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: paymentIntent.id,
        items: itemsPayload,
        discountCode: discountCode ?? null,
        customer: {
          first_name: customer.firstName,
          last_name: customer.lastName,
          email: customer.email,
          phone: customer.phone || null,
        },
        shipping: {
          address1: shipping.address1,
          address2: shipping.address2 || null,
          postal_code: shipping.postalCode,
          city: shipping.city,
          country: shipping.country || "FR",
        },
      }),
    });

    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string | string[];
      order?: { public_id?: string };
    };

    if (!response.ok || !payload.ok || !payload.order?.public_id) {
      const errorText = Array.isArray(payload.error)
        ? payload.error.join(" ")
        : payload.error;
      setErrorMessage(errorText || "Commande Stripe invalide.");
      setSubmitting(false);
      return;
    }

    onPaid(payload.order.public_id);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="w-full bg-blue-600 py-3 text-sm text-white disabled:opacity-60"
        onClick={handleSubmit}
        disabled={disabled || submitting || !stripe || !elements}
      >
        {submitting ? "Paiement en cours..." : "Payer maintenant"}
      </button>
      {errorMessage ? (
        <p className="text-xs text-red-600">{errorMessage}</p>
      ) : null}
    </div>
  );
}

export default function CheckoutClient({
  fontClassName,
  storeName,
  logoUrl,
  shippingCents,
  stripePublishableKey,
}: CheckoutClientProps) {
  const router = useRouter();
  const {
    items,
    totalCents,
    discount,
    setDiscount,
    clear,
  } = useCart();
  const normalizedStripeKey = stripePublishableKey?.trim() ?? "";
  const stripePromise = useMemo(
    () => (normalizedStripeKey ? loadStripe(normalizedStripeKey) : null),
    [normalizedStripeKey],
  );

  const [customer, setCustomer] = useState<CustomerFormState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [shipping, setShipping] = useState<ShippingFormState>({
    address1: "",
    address2: "",
    postalCode: "",
    city: "",
    country: "FR",
  });

  const [discountInput, setDiscountInput] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [serverTotalCents, setServerTotalCents] = useState<number | null>(null);

  const itemsPayload = useMemo(
    () =>
      items.map((item) => ({
        product_id: item.id,
        qty: item.quantity,
      })),
    [items],
  );

  const subtotalCents = totalCents;
  const discountCents = useMemo(
    () => calculateDiscountCents(subtotalCents + shippingCents, discount),
    [discount, shippingCents, subtotalCents],
  );
  const computedTotalCents = Math.max(
    subtotalCents + shippingCents - discountCents,
    0,
  );
  const displayTotalCents = serverTotalCents ?? computedTotalCents;

  const hasStripeKey = Boolean(normalizedStripeKey);

  useEffect(() => {
    let active = true;
    if (!itemsPayload.length || !normalizedStripeKey) {
      setClientSecret(null);
      setPaymentIntentId(null);
      setServerTotalCents(null);
      return;
    }

    const createIntent = async () => {
      setIntentLoading(true);
      setIntentError(null);
      try {
        const response = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: itemsPayload,
            discountCode: discount?.code ?? null,
          }),
        });
        const data = (await response.json()) as {
          clientSecret?: string;
          paymentIntentId?: string;
          amountCents?: number;
          error?: string;
        };
        if (!response.ok || !data.clientSecret) {
          if (active) {
            setClientSecret(null);
            setPaymentIntentId(null);
            setServerTotalCents(null);
            setIntentError(data?.error || "Impossible de preparer le paiement.");
          }
          return;
        }
        if (active) {
          setClientSecret(data.clientSecret);
          setPaymentIntentId(data.paymentIntentId ?? null);
          if (typeof data.amountCents === "number") {
            setServerTotalCents(data.amountCents);
          }
        }
      } catch {
        if (active) {
          setClientSecret(null);
          setPaymentIntentId(null);
          setServerTotalCents(null);
          setIntentError("Impossible de preparer le paiement.");
        }
      } finally {
        if (active) {
          setIntentLoading(false);
        }
      }
    };

    createIntent();

    return () => {
      active = false;
    };
  }, [discount?.code, itemsPayload, normalizedStripeKey]);

  const handleApplyDiscount = async () => {
    const code = discountInput.trim().toUpperCase();
    if (!code || subtotalCents <= 0) {
      return;
    }
    setDiscountError(null);
    setDiscountLoading(true);
    try {
      const response = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotalCents }),
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

  const onPaid = (orderPublicId: string) => {
    clear();
    router.push(`/merci?order=${encodeURIComponent(orderPublicId)}`);
  };

  return (
    <div className={`storefront ${fontClassName} min-h-screen bg-white text-black`}>
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={storeName}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <span className="text-sm uppercase tracking-wide">{storeName}</span>
            )}
          </Link>
          <button
            type="button"
            className="flex items-center justify-center text-blue-600"
            aria-label="Panier"
          >
            <ShoppingBag className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1200px] px-4 pb-12 pt-6 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10 lg:pt-10">
        <details className="group border-b border-neutral-200 pb-4 lg:hidden">
          <summary className="flex cursor-pointer items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-blue-600">
              Resume de la commande
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </span>
            <span className="text-base text-black">
              {formatPrice(displayTotalCents)}
            </span>
          </summary>
          <div className="mt-4 space-y-4 text-sm">
            {items.length ? (
              items.map((item) => {
                const key = `${item.id}-${item.variantLabel ?? "default"}`;
                return (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 border border-neutral-200 bg-neutral-100">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div>
                        <p className="text-sm">{item.title}</p>
                        {item.variantLabel ? (
                          <p className="text-xs text-neutral-500">
                            {item.variantLabel}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span>{formatPrice(item.priceCents * item.quantity)}</span>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-neutral-500">Panier vide.</p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="code de reduction"
                value={discountInput}
                onChange={(event) => {
                  setDiscountInput(event.target.value);
                  if (discountError) {
                    setDiscountError(null);
                  }
                }}
                className="h-10 flex-1 border border-neutral-300 px-3 text-sm"
              />
              <button
                className="h-10 border border-neutral-300 px-4 text-sm text-neutral-500 disabled:opacity-60"
                onClick={handleApplyDiscount}
                type="button"
                disabled={discountLoading || !discountInput.trim()}
              >
                Valider
              </button>
            </div>
            {discountError ? (
              <p className="text-xs text-red-600">{discountError}</p>
            ) : null}
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Sous-total</span>
              <span>{formatPrice(subtotalCents)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Expedition</span>
              <span>
                {shippingCents ? formatPrice(shippingCents) : "Offerte"}
              </span>
            </div>
            {discount && discountCents ? (
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Reduction</span>
                <span>-{formatPrice(discountCents)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Total</span>
              <span className="text-black">
                EUR {formatPrice(displayTotalCents)}
              </span>
            </div>
          </div>
        </details>

        <div className="space-y-8 pb-8 lg:pb-0">
          <section className="space-y-4 text-center">
            <p className="text-sm text-neutral-500">Paiement express</p>
            <button className="mx-auto w-full max-w-sm bg-[#ffc439] py-2 text-base font-semibold text-[#003087] lg:max-w-md">
              PayPal
            </button>
            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <div className="h-px flex-1 bg-neutral-200" />
              <span>OU</span>
              <div className="h-px flex-1 bg-neutral-200" />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg">Contact</h2>
            <input
              type="email"
              placeholder="Adresse e-mail"
              className="h-12 w-full border border-neutral-300 px-3 text-sm"
              value={customer.email}
              onChange={(event) =>
                setCustomer((prev) => ({ ...prev, email: event.target.value }))
              }
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg">Livraison</h2>
            <div className="grid grid-cols-2 gap-3 rounded bg-neutral-100 p-1">
              <button className="flex items-center justify-center gap-2 bg-white py-2 text-sm shadow-sm">
                <Truck className="h-4 w-4" />
                Livraison
              </button>
              <button className="flex items-center justify-center gap-2 py-2 text-sm text-neutral-500">
                <Store className="h-4 w-4" />
                Retrait
              </button>
            </div>
            <div className="grid gap-3">
              <div className="flex items-center justify-between border border-neutral-300 px-3 py-3 text-sm">
                <span>Pays/region</span>
                <span>{shipping.country || "France"}</span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <input
                  type="text"
                  placeholder="Prenom"
                  className="h-12 border border-neutral-300 px-3 text-sm"
                  value={customer.firstName}
                  onChange={(event) =>
                    setCustomer((prev) => ({
                      ...prev,
                      firstName: event.target.value,
                    }))
                  }
                />
                <input
                  type="text"
                  placeholder="Nom"
                  className="h-12 border border-neutral-300 px-3 text-sm"
                  value={customer.lastName}
                  onChange={(event) =>
                    setCustomer((prev) => ({
                      ...prev,
                      lastName: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex items-center gap-2 border border-neutral-300 px-3 text-sm">
                <input
                  type="text"
                  placeholder="Adresse"
                  className="h-12 flex-1 bg-transparent text-sm"
                  value={shipping.address1}
                  onChange={(event) =>
                    setShipping((prev) => ({
                      ...prev,
                      address1: event.target.value,
                    }))
                  }
                />
                <Search className="h-4 w-4 text-neutral-400" />
              </div>
              <input
                type="text"
                placeholder="Appartement, suite, etc. (optionnel)"
                className="h-12 border border-neutral-300 px-3 text-sm"
                value={shipping.address2}
                onChange={(event) =>
                  setShipping((prev) => ({
                    ...prev,
                    address2: event.target.value,
                  }))
                }
              />
              <div className="grid gap-3 lg:grid-cols-2">
                <input
                  type="text"
                  placeholder="Code postal"
                  className="h-12 border border-neutral-300 px-3 text-sm"
                  value={shipping.postalCode}
                  onChange={(event) =>
                    setShipping((prev) => ({
                      ...prev,
                      postalCode: event.target.value,
                    }))
                  }
                />
                <input
                  type="text"
                  placeholder="Ville"
                  className="h-12 border border-neutral-300 px-3 text-sm"
                  value={shipping.city}
                  onChange={(event) =>
                    setShipping((prev) => ({
                      ...prev,
                      city: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex items-center gap-2 border border-neutral-300 px-3 text-sm">
                <input
                  type="text"
                  placeholder="Telephone (optionnel)"
                  className="h-12 flex-1 bg-transparent text-sm"
                  value={customer.phone}
                  onChange={(event) =>
                    setCustomer((prev) => ({
                      ...prev,
                      phone: event.target.value,
                    }))
                  }
                />
                <HelpCircle className="h-4 w-4 text-neutral-400" />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg">Mode d’expedition</h2>
            <div className="rounded bg-neutral-100 p-4 text-sm text-neutral-500">
              Livraison {shippingCents ? formatPrice(shippingCents) : "offerte"}.
            </div>
          </section>

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg">Paiement</h2>
              <p className="text-xs text-neutral-500">
                Toutes les transactions sont securisees et chiffrees.
              </p>
            </div>
            <div className="border border-blue-600">
              <div className="flex items-center justify-between border-b border-blue-600 px-3 py-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked readOnly />
                  Carte de credit
                </label>
                <div className="flex items-center gap-1 text-xs text-neutral-500">
                  <span className="border border-neutral-200 px-1">VISA</span>
                  <span className="border border-neutral-200 px-1">MC</span>
                  <span className="border border-neutral-200 px-1">AMEX</span>
                  <span className="border border-neutral-200 px-1">+2</span>
                </div>
              </div>
              <div className="space-y-3 bg-neutral-50 p-3 text-sm">
                {!hasStripeKey ? (
                  <div className="rounded border border-neutral-200 bg-white p-3 text-xs text-red-600">
                    Cle Stripe publique manquante.
                  </div>
                ) : intentError ? (
                  <div className="rounded border border-neutral-200 bg-white p-3 text-xs text-red-600">
                    {intentError}
                  </div>
                ) : intentLoading ? (
                  <div className="rounded border border-neutral-200 bg-white p-3 text-xs text-neutral-500">
                    Chargement du paiement...
                  </div>
                ) : clientSecret ? (
                  <Elements
                    key={clientSecret}
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      appearance: {
                        theme: "stripe",
                        variables: {
                          fontFamily: "Futura PT, Arial, sans-serif",
                          colorPrimary: "#2563eb",
                          colorText: "#0a0a0a",
                          colorBackground: "#fafafa",
                          borderRadius: "4px",
                        },
                      },
                    }}
                  >
                    <div className="space-y-3">
                      <div className="px-3 py-2">
                        <PaymentElement />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-600">
                        <Lock className="h-3.5 w-3.5 text-neutral-400" />
                        Paiement securise par Stripe.
                      </div>
                    </div>
                    <section className="mt-6 space-y-3">
                      {discount ? (
                        <div className="flex items-center justify-between text-xs text-neutral-500">
                          <span>Reduction</span>
                          <span>-{formatPrice(discountCents)}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 border border-neutral-200 bg-neutral-100" />
                          <div>
                            <p>Total</p>
                            <p className="text-xs text-neutral-500">
                              {items.length} article
                              {items.length > 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-neutral-500">EUR</span>
                          <p className="text-lg">
                            {formatPrice(displayTotalCents)}
                          </p>
                        </div>
                      </div>
                      <StripePayButton
                        customer={customer}
                        shipping={shipping}
                        itemsPayload={itemsPayload}
                        discountCode={discount?.code ?? null}
                        paymentIntentId={paymentIntentId}
                        onPaid={onPaid}
                        disabled={!itemsPayload.length}
                      />
                    </section>
                  </Elements>
                ) : (
                  <div className="rounded border border-neutral-200 bg-white p-3 text-xs text-neutral-500">
                    Paiement indisponible.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="rounded border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="space-y-4 text-sm">
              {items.length ? (
                items.map((item) => {
                  const key = `${item.id}-${item.variantLabel ?? "default"}`;
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="h-12 w-12 border border-neutral-200 bg-neutral-100">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black text-xs text-white">
                            {item.quantity}
                          </span>
                        </div>
                        <div>
                          <p>{item.title}</p>
                          {item.variantLabel ? (
                            <p className="text-xs text-neutral-500">
                              {item.variantLabel}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <span>{formatPrice(item.priceCents * item.quantity)}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-neutral-500">Panier vide.</p>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="code de reduction"
                  value={discountInput}
                  onChange={(event) => {
                    setDiscountInput(event.target.value);
                    if (discountError) {
                      setDiscountError(null);
                    }
                  }}
                  className="h-10 flex-1 border border-neutral-300 px-3 text-sm"
                />
                <button
                  type="button"
                  className="h-10 border border-neutral-300 px-4 text-sm text-neutral-500 disabled:opacity-60"
                  onClick={handleApplyDiscount}
                  disabled={discountLoading || !discountInput.trim()}
                >
                  Valider
                </button>
              </div>
              {discountError ? (
                <p className="text-xs text-red-600">{discountError}</p>
              ) : null}
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Sous-total</span>
                <span>{formatPrice(subtotalCents)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Expedition</span>
                <span>{shippingCents ? formatPrice(shippingCents) : "Offerte"}</span>
              </div>
              {discount && discountCents ? (
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>Reduction</span>
                  <span>-{formatPrice(discountCents)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total</span>
                <span className="text-black">
                  EUR {formatPrice(displayTotalCents)}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
