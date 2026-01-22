"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { DEFAULT_COUNTRY } from "@/lib/constants";

type CheckoutClientProps = {
  fontClassName: string;
  storeName: string;
  logoUrl?: string | null;
  shippingCents: number;
  stripePublishableKey?: string | null;
  googleMapsApiKey?: string | null;
  checkoutCountryCodes?: string[] | null;
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

type ShippingOptionItem = {
  id: number;
  carrier: string;
  title: string;
  description: string | null;
  price: string;
  min_order_total: string | null;
  max_order_total: string | null;
  shipping_type?: string | null;
};

type ServicePoint = {
  id: number;
  name: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  distance?: number | null;
  formatted_opening_times?: Record<string, string[]> | null;
};

function formatPrice(cents: number) {
  const value = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `${value.replace(/\u00a0|\u202f/g, " ")} €`;
}

type AddressParts = {
  address1?: string;
  postalCode?: string;
  city?: string;
};

function getCountryLabel(code: string, locale = "fr") {
  try {
    const display = new Intl.DisplayNames([locale], { type: "region" });
    return display.of(code) ?? code;
  } catch {
    return code;
  }
}

function extractAddressParts(components: Array<any>): AddressParts {
  let streetNumber = "";
  let route = "";
  let postalCode = "";
  let locality = "";
  let postalTown = "";
  let sublocality = "";
  let adminArea2 = "";
  let adminArea1 = "";

  components.forEach((component) => {
    const types = Array.isArray(component?.types) ? component.types : [];
    if (types.includes("street_number")) {
      streetNumber = component.long_name || component.short_name || "";
    }
    if (types.includes("route")) {
      route = component.long_name || component.short_name || "";
    }
    if (types.includes("postal_code")) {
      postalCode = component.long_name || component.short_name || "";
    }
    if (types.includes("locality")) {
      locality = component.long_name || component.short_name || "";
    }
    if (types.includes("postal_town")) {
      postalTown = component.long_name || component.short_name || "";
    }
    if (types.includes("sublocality_level_1")) {
      sublocality = component.long_name || component.short_name || "";
    }
    if (types.includes("administrative_area_level_2")) {
      adminArea2 = component.long_name || component.short_name || "";
    }
    if (types.includes("administrative_area_level_1")) {
      adminArea1 = component.long_name || component.short_name || "";
    }
  });

  const address1 = [streetNumber, route].filter(Boolean).join(" ").trim();
  const city = locality || postalTown || sublocality || adminArea2 || adminArea1;

  return {
    address1: address1 || undefined,
    postalCode: postalCode || undefined,
    city: city || undefined,
  };
}

function formatDistance(distance?: number | null) {
  if (typeof distance !== "number" || !Number.isFinite(distance)) return null;
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1).replace(".", ",")} km`;
  }
  return `${Math.round(distance)} m`;
}

function parsePriceToCents(value: string | null) {
  if (!value) return null;
  const normalized = value.replace(",", ".");
  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
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
  shippingOptionId,
  paymentIntentId,
  servicePoint,
  onPaid,
  disabled,
}: {
  customer: CustomerFormState;
  shipping: ShippingFormState;
  itemsPayload: Array<{ product_id: number; qty: number }>;
  discountCode?: string | null;
  shippingOptionId?: number | null;
  paymentIntentId?: string | null;
  servicePoint: ServicePoint | null;
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
              country: shipping.country || DEFAULT_COUNTRY,
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
              country: shipping.country || DEFAULT_COUNTRY,
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
              country: shipping.country || DEFAULT_COUNTRY,
            },
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
        shippingOptionId: shippingOptionId ?? null,
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
          country: shipping.country || DEFAULT_COUNTRY,
        },
        servicePoint: servicePoint
          ? {
              id: servicePoint.id,
              name: servicePoint.name,
              street: servicePoint.street,
              house_number: servicePoint.house_number,
              postal_code: servicePoint.postal_code,
              city: servicePoint.city,
              distance: servicePoint.distance ?? null,
            }
          : null,
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
  googleMapsApiKey,
  checkoutCountryCodes,
}: CheckoutClientProps) {
  const router = useRouter();
  const normalizedCountryCodes = useMemo(() => {
    if (!checkoutCountryCodes?.length) return [DEFAULT_COUNTRY];
    const normalized = checkoutCountryCodes
      .map((code) => code?.toString().trim().toUpperCase())
      .filter((code) => code);
    return Array.from(new Set(normalized.length ? normalized : [DEFAULT_COUNTRY]));
  }, [checkoutCountryCodes]);
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
    country: normalizedCountryCodes[0] ?? DEFAULT_COUNTRY,
  });
  const countryRestriction = useMemo(() => {
    const current = shipping.country || normalizedCountryCodes[0] || DEFAULT_COUNTRY;
    return current.toLowerCase();
  }, [normalizedCountryCodes, shipping.country]);
  const [shippingOptions, setShippingOptions] = useState<ShippingOptionItem[]>([]);
  const [shippingOptionsLoading, setShippingOptionsLoading] = useState(false);
  const [shippingOptionsLoaded, setShippingOptionsLoaded] = useState(false);
  const [shippingOptionsError, setShippingOptionsError] = useState<string | null>(
    null,
  );
  const [selectedShippingOptionId, setSelectedShippingOptionId] = useState<
    number | null
  >(null);
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);
  const [servicePointsLoading, setServicePointsLoading] = useState(false);
  const [servicePointsError, setServicePointsError] = useState<string | null>(null);
  const [selectedServicePointId, setSelectedServicePointId] = useState<
    number | null
  >(null);
  const [isServicePointDrawerOpen, setIsServicePointDrawerOpen] = useState(false);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  const autocompleteListenerRef = useRef<{ remove: () => void } | null>(null);

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

  const hasFullAddress = Boolean(
    shipping.address1.trim() && shipping.postalCode.trim() && shipping.city.trim(),
  );

  const subtotalCents = totalCents;

  const eligibleShippingOptions = useMemo(() => {
    if (!shippingOptions.length) return [];
    return shippingOptions.filter((option) => {
      const minCents = parsePriceToCents(option.min_order_total);
      const maxCents = parsePriceToCents(option.max_order_total);
      if (minCents !== null && subtotalCents < minCents) {
        return false;
      }
      if (maxCents !== null && subtotalCents > maxCents) {
        return false;
      }
      return true;
    });
  }, [shippingOptions, subtotalCents]);

  const selectedShippingOption = useMemo(() => {
    if (!selectedShippingOptionId) return null;
    return (
      eligibleShippingOptions.find(
        (option) => option.id === selectedShippingOptionId,
      ) ?? null
    );
  }, [eligibleShippingOptions, selectedShippingOptionId]);

  const isServicePointOption =
    selectedShippingOption?.shipping_type === "service_points";
  const selectedServicePoint = useMemo(() => {
    if (!selectedServicePointId) return null;
    return (
      servicePoints.find((point) => point.id === selectedServicePointId) ?? null
    );
  }, [servicePoints, selectedServicePointId]);
  const requiresServicePointSelection =
    isServicePointOption && hasFullAddress && !selectedServicePointId;

  const defaultShippingCents = shippingCents;
  const selectedShippingPriceCents = selectedShippingOption
    ? parsePriceToCents(selectedShippingOption.price)
    : null;

  const requiresShippingOption =
    hasFullAddress && shippingOptionsLoaded && shippingOptions.length > 0;
  const selectedShippingCents =
    selectedShippingPriceCents !== null
      ? selectedShippingPriceCents
      : requiresShippingOption
        ? 0
        : defaultShippingCents;
  const discountCents = useMemo(
    () => calculateDiscountCents(subtotalCents + selectedShippingCents, discount),
    [discount, selectedShippingCents, subtotalCents],
  );
  const computedTotalCents = Math.max(
    subtotalCents + selectedShippingCents - discountCents,
    0,
  );
  const displayTotalCents = serverTotalCents ?? computedTotalCents;
  const totalItemCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  const hasStripeKey = Boolean(normalizedStripeKey);
  const googlePlacesKey = googleMapsApiKey?.trim() ?? "";

  useEffect(() => {
    if (!normalizedCountryCodes.length) return;
    if (normalizedCountryCodes.includes(shipping.country)) return;
    setShipping((prev) => ({
      ...prev,
      country: normalizedCountryCodes[0] ?? DEFAULT_COUNTRY,
    }));
  }, [normalizedCountryCodes, shipping.country]);

  useEffect(() => {
    if (!googlePlacesKey || !addressInputRef.current) {
      return;
    }

    const setupAutocomplete = () => {
      const googleMaps = (window as any).google;
      if (!googleMaps?.maps?.places || !addressInputRef.current) {
        return;
      }

      autocompleteRef.current = new googleMaps.maps.places.Autocomplete(
        addressInputRef.current,
        {
          types: ["address"],
          fields: ["address_components"],
          componentRestrictions: { country: countryRestriction },
        },
      );

      autocompleteListenerRef.current = autocompleteRef.current.addListener(
        "place_changed",
        () => {
          const place = autocompleteRef.current?.getPlace?.();
          const parts = extractAddressParts(place?.address_components ?? []);
          setShipping((prev) => ({
            ...prev,
            address1: parts.address1 ?? prev.address1,
            postalCode: parts.postalCode ?? prev.postalCode,
            city: parts.city ?? prev.city,
          }));
        },
      );
    };

    const existingScript = document.querySelector(
      'script[data-google-places="true"]',
    ) as HTMLScriptElement | null;

    if (existingScript) {
      if ((window as any).google?.maps?.places) {
        setupAutocomplete();
      } else {
        existingScript.addEventListener("load", setupAutocomplete, { once: true });
      }
      return () => {
        autocompleteListenerRef.current?.remove();
        autocompleteListenerRef.current = null;
        existingScript.removeEventListener("load", setupAutocomplete);
      };
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googlePlacesKey}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.googlePlaces = "true";
    script.addEventListener("load", setupAutocomplete);
    document.head.appendChild(script);

    return () => {
      autocompleteListenerRef.current?.remove();
      autocompleteListenerRef.current = null;
      script.removeEventListener("load", setupAutocomplete);
    };
  }, [googlePlacesKey, countryRestriction]);

  useEffect(() => {
    if (!autocompleteRef.current) return;
    autocompleteRef.current.setComponentRestrictions({
      country: countryRestriction,
    });
  }, [countryRestriction]);

  const loadShippingOptions = async () => {
    if (shippingOptionsLoading) return;
    setShippingOptionsLoading(true);
    setShippingOptionsError(null);
    try {
      const response = await fetch("/api/shipping/options");
      const data = (await response.json().catch(() => null)) as
        | { options?: ShippingOptionItem[]; error?: string }
        | null;
      if (!response.ok) {
        setShippingOptionsError(data?.error || "Impossible de charger la livraison.");
        return;
      }
      setShippingOptions(Array.isArray(data?.options) ? data.options : []);
    } catch {
      setShippingOptionsError("Impossible de charger la livraison.");
    } finally {
      setShippingOptionsLoaded(true);
      setShippingOptionsLoading(false);
    }
  };

  useEffect(() => {
    if (
      !itemsPayload.length ||
      !hasFullAddress ||
      shippingOptionsLoaded ||
      shippingOptionsLoading
    ) {
      return;
    }
    void loadShippingOptions();
  }, [itemsPayload.length, hasFullAddress, shippingOptionsLoaded, shippingOptionsLoading]);

  useEffect(() => {
    if (!eligibleShippingOptions.length) {
      setSelectedShippingOptionId(null);
      return;
    }
    const isSelectedStillValid = selectedShippingOptionId
      ? eligibleShippingOptions.some(
          (option) => option.id === selectedShippingOptionId,
        )
      : false;
    if (!isSelectedStillValid) {
      setSelectedShippingOptionId(eligibleShippingOptions[0]?.id ?? null);
    }
  }, [eligibleShippingOptions, selectedShippingOptionId]);

  useEffect(() => {
    if (!isServicePointOption) {
      setServicePoints([]);
      setSelectedServicePointId(null);
      setServicePointsError(null);
      setServicePointsLoading(false);
      setIsServicePointDrawerOpen(false);
      return;
    }
    if (!hasFullAddress) {
      setServicePoints([]);
      setSelectedServicePointId(null);
      setServicePointsError(null);
      setServicePointsLoading(false);
      setIsServicePointDrawerOpen(false);
      return;
    }
    let active = true;
    const loadServicePoints = async () => {
      setServicePointsLoading(true);
      setServicePointsError(null);
      try {
        const fullAddress = [
          shipping.address1.trim(),
          shipping.address2.trim(),
          shipping.postalCode.trim(),
          shipping.city.trim(),
        ]
          .filter(Boolean)
          .join(" ");
        const params = new URLSearchParams({
          country: shipping.country || DEFAULT_COUNTRY,
          address: fullAddress,
          postal_code: shipping.postalCode.trim(),
          city: shipping.city.trim(),
        });
        if (selectedShippingOption?.carrier) {
          params.set("carrier", selectedShippingOption.carrier);
        }
        const response = await fetch(`/api/shipping/service-points?${params}`);
        const data = (await response.json().catch(() => null)) as
          | { servicePoints?: ServicePoint[]; error?: string }
          | null;
        if (!response.ok) {
          if (active) {
            setServicePointsError(
              data?.error || "Impossible de charger les points relais.",
            );
          }
          return;
        }
        const points = Array.isArray(data?.servicePoints) ? data.servicePoints : [];
        if (active) {
          setServicePoints(points);
          const hasSelection = selectedServicePointId
            ? points.some((point) => point.id === selectedServicePointId)
            : false;
          if (!hasSelection) {
            setSelectedServicePointId(null);
          }
        }
      } catch {
        if (active) {
          setServicePointsError("Impossible de charger les points relais.");
        }
      } finally {
        if (active) {
          setServicePointsLoading(false);
        }
      }
    };
    void loadServicePoints();
    return () => {
      active = false;
    };
  }, [
    isServicePointOption,
    hasFullAddress,
    shipping.address1,
    shipping.address2,
    shipping.country,
    shipping.city,
    shipping.postalCode,
    selectedShippingOption?.carrier,
    selectedServicePointId,
  ]);

  useEffect(() => {
    let active = true;
    if (
      !itemsPayload.length ||
      !normalizedStripeKey ||
      (requiresShippingOption && !selectedShippingOptionId)
    ) {
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
            shippingOptionId: selectedShippingOptionId,
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
  }, [
    discount?.code,
    itemsPayload,
    normalizedStripeKey,
    requiresShippingOption,
    selectedShippingOptionId,
  ]);

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
    <div
      className={`storefront ${fontClassName} min-h-screen bg-white text-black text-[16px] [&_*]:text-[16px]`}
    >
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
                        <p className="text-xs text-neutral-500">
                          Quantite: {item.quantity}
                        </p>
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
                className="h-10 flex-1 border border-neutral-300 px-3 text-[16px] sm:text-sm"
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
                {selectedShippingCents
                  ? formatPrice(selectedShippingCents)
                  : "Offerte"}
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
              className="h-12 w-full border border-neutral-300 px-3 text-[16px] sm:text-sm"
              value={customer.email}
              onChange={(event) =>
                setCustomer((prev) => ({ ...prev, email: event.target.value }))
              }
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg">Livraison</h2>
            <div className="grid gap-3">
              <div className="flex items-center justify-between border border-neutral-300 px-3 py-3 text-sm">
                <span>Pays/region</span>
                {normalizedCountryCodes.length > 1 ? (
                  <select
                    value={shipping.country}
                    onChange={(event) =>
                      setShipping((prev) => ({
                        ...prev,
                        country: event.target.value,
                      }))
                    }
                    className="text-right text-[16px] sm:text-sm"
                  >
                    {normalizedCountryCodes.map((code) => (
                      <option key={code} value={code}>
                        {getCountryLabel(code)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{getCountryLabel(shipping.country || DEFAULT_COUNTRY)}</span>
                )}
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <input
                  type="text"
                  placeholder="Prenom"
                  className="h-12 border border-neutral-300 px-3 text-[16px] sm:text-sm"
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
                  className="h-12 border border-neutral-300 px-3 text-[16px] sm:text-sm"
                  value={customer.lastName}
                  onChange={(event) =>
                    setCustomer((prev) => ({
                      ...prev,
                      lastName: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex items-center gap-2 border border-neutral-300 px-3 text-[16px] sm:text-sm">
                <input
                  type="text"
                  placeholder="Adresse"
                  className="h-12 flex-1 bg-transparent text-[16px] sm:text-sm"
                  ref={addressInputRef}
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
                className="h-12 border border-neutral-300 px-3 text-[16px] sm:text-sm"
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
                  className="h-12 border border-neutral-300 px-3 text-[16px] sm:text-sm"
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
                  className="h-12 border border-neutral-300 px-3 text-[16px] sm:text-sm"
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
                  className="h-12 flex-1 bg-transparent text-[16px] sm:text-sm"
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
            <p className="text-xs text-neutral-500">
              24/48h de traitement en plus des délais de livraison
            </p>
            <div className="space-y-3">
              {!hasFullAddress ? (
                <div className="rounded bg-neutral-100 p-4 text-sm text-neutral-500">
                  Entrez votre adresse complete pour voir les options de livraison.
                </div>
              ) : shippingOptionsLoading ? (
                <div className="rounded bg-neutral-100 p-4 text-sm text-neutral-500">
                  Chargement des options de livraison...
                </div>
              ) : shippingOptionsError ? (
                <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                  {shippingOptionsError}
                </div>
              ) : eligibleShippingOptions.length === 0 ? (
                <div className="rounded bg-neutral-100 p-4 text-sm text-neutral-500">
                  Aucune option de livraison disponible.
                </div>
              ) : (
                <div className="space-y-2">
                  {eligibleShippingOptions.map((option) => {
                    const priceCents = parsePriceToCents(option.price) ?? 0;
                    const isSelected = option.id === selectedShippingOptionId;
                    return (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-start justify-between gap-4 rounded border px-3 py-3 text-sm transition ${
                          isSelected
                            ? "border-blue-600 bg-blue-50"
                            : "border-neutral-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="shipping-option"
                            checked={isSelected}
                            onChange={() => setSelectedShippingOptionId(option.id)}
                          />
                          <div>
                            <p className="font-medium text-neutral-900">
                              {option.title}
                            </p>
                            {option.description ? (
                              <p className="text-xs text-neutral-500">
                                {option.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <span className="text-sm text-neutral-700">
                          {priceCents ? formatPrice(priceCents) : "Offerte"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {isServicePointOption && hasFullAddress ? (
                <div className="rounded border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
                  <p className="text-xs uppercase text-neutral-500">
                    Points relais
                  </p>
                  <Drawer
                    open={isServicePointDrawerOpen}
                    onOpenChange={setIsServicePointDrawerOpen}
                  >
                    <DrawerTrigger asChild>
                      <button
                        type="button"
                        className="mt-3 w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-800 transition hover:border-neutral-400"
                      >
                        {selectedServicePoint
                          ? "Changer de point relais"
                          : "Choisir un point relais"}
                      </button>
                    </DrawerTrigger>
                    <DrawerContent className="h-[80vh] sm:h-auto sm:max-h-[95vh]">
                      <DrawerHeader className="px-4 pb-2 pt-4">
                        <DrawerTitle className="text-sm">
                          Choisir un point relais
                        </DrawerTitle>
                      </DrawerHeader>
                      <div className="px-4 pb-6">
                        {servicePointsLoading ? (
                          <p className="text-xs text-neutral-500">
                            Chargement des points relais...
                          </p>
                        ) : servicePointsError ? (
                          <p className="text-xs text-red-600">
                            {servicePointsError}
                          </p>
                        ) : servicePoints.length === 0 ? (
                          <p className="text-xs text-neutral-500">
                            Aucun point relais disponible.
                          </p>
                        ) : (
                          <div className="max-h-72 space-y-2 overflow-y-auto pr-2">
                            {servicePoints.map((point) => {
                              const isSelected =
                                point.id === selectedServicePointId;
                              const distance = formatDistance(point.distance);
                              const openingTimes = point.formatted_opening_times;
                              const dayLabels = [
                                "Lun",
                                "Mar",
                                "Mer",
                                "Jeu",
                                "Ven",
                                "Sam",
                                "Dim",
                              ];
                              const hasOpeningTimes = Boolean(
                                openingTimes &&
                                  dayLabels.some((_, index) => {
                                    const slots = openingTimes?.[String(index)];
                                    return Array.isArray(slots) && slots.length > 0;
                                  }),
                              );
                              return (
                                <label
                                  key={point.id}
                                  className={`flex cursor-pointer items-start justify-between gap-3 rounded border px-3 py-2 text-xs transition ${
                                    isSelected
                                      ? "border-blue-600 bg-blue-50"
                                      : "border-neutral-200 bg-white"
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <input
                                      type="radio"
                                      name="service-point"
                                      checked={isSelected}
                                      onChange={() => {
                                        setSelectedServicePointId(point.id);
                                        setIsServicePointDrawerOpen(false);
                                      }}
                                    />
                                    <div>
                                      <p className="text-sm font-medium text-neutral-900">
                                        {point.name}
                                      </p>
                                      <p className="text-xs text-neutral-500">
                                        {point.house_number} {point.street}
                                        <br />
                                        {point.postal_code} {point.city}
                                      </p>
                                      {hasOpeningTimes ? (
                                        <div className="mt-2 space-y-0.5 text-[11px] text-neutral-500">
                                          {dayLabels.map((label, index) => {
                                            const slots =
                                              openingTimes?.[String(index)] ?? [];
                                            const value =
                                              Array.isArray(slots) && slots.length
                                                ? slots.join(", ")
                                                : "Fermé";
                                            return (
                                              <div key={label} className="flex gap-2">
                                                <span className="w-7">
                                                  {label}
                                                </span>
                                                <span>{value}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                  {distance ? (
                                    <span className="min-w-[52px] text-right text-xs text-neutral-500">
                                      {distance}
                                    </span>
                                  ) : null}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </DrawerContent>
                  </Drawer>
                  {requiresServicePointSelection ? (
                    <p className="mt-2 text-xs text-red-600">
                      Choisissez un point relais pour continuer.
                    </p>
                  ) : null}
                  {servicePointsError ? (
                    <p className="mt-2 text-xs text-red-600">{servicePointsError}</p>
                  ) : servicePointsLoading ? (
                    <p className="mt-2 text-xs text-neutral-500">
                      Chargement des points relais...
                    </p>
                  ) : null}
                  {selectedServicePoint ? (
                    <div className="mt-3 rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
                      <p className="text-sm font-medium text-neutral-900">
                        {selectedServicePoint.name}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {selectedServicePoint.street}{" "}
                        {selectedServicePoint.house_number},{" "}
                        {selectedServicePoint.postal_code}{" "}
                        {selectedServicePoint.city}
                      </p>
                      {formatDistance(selectedServicePoint.distance) ? (
                        <p className="mt-1 text-xs text-neutral-500">
                          {formatDistance(selectedServicePoint.distance)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
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
                              {totalItemCount} article
                              {totalItemCount > 1 ? "s" : ""}
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
                        shippingOptionId={selectedShippingOptionId}
                        paymentIntentId={paymentIntentId}
                        servicePoint={selectedServicePoint}
                        onPaid={onPaid}
                        disabled={
                          !itemsPayload.length ||
                          (requiresShippingOption && !selectedShippingOptionId) ||
                          requiresServicePointSelection
                        }
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
                  className="h-10 flex-1 border border-neutral-300 px-3 text-[16px] sm:text-sm"
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
                <span>
                  {selectedShippingCents
                    ? formatPrice(selectedShippingCents)
                    : "Offerte"}
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
          </div>
        </aside>
      </div>

    </div>
  );
}
