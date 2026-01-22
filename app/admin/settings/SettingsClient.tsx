"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { Check, GripVertical, Pencil } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import AdminShell from "@/app/admin/components/AdminShell";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SettingsData = {
  storeName: string;
  domain: string;
  websiteTitle: string;
  websiteDescription: string;
  defaultCurrency: string;
  logoUrl: string;
  logoTransparentUrl: string;
  brevoApiKeyHint: string | null;
  stripePublishableKeyHint: string | null;
  stripeSecretKeyHint: string | null;
  paypalClientIdHint: string | null;
  paypalClientSecretHint: string | null;
  sendcloudPublicKeyHint: string | null;
  sendcloudPrivateKeyHint: string | null;
  googleMapsApiKeyHint: string | null;
  googleMapsCountryCodes: string[];
};

type SettingsClientProps = {
  settings: SettingsData;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

type ShippingOptionItem = {
  id: number;
  carrier: string;
  shipping_type: string;
  title: string;
  description: string | null;
  price: string;
  min_order_total: string | null;
  max_order_total: string | null;
  position: number;
};

const MENU_ITEMS = ["General", "Emailing", "Payments", "Shipping", "Users"] as const;
type MenuItem = (typeof MENU_ITEMS)[number];
const selectClassName =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const SHIPPING_TYPE_OPTIONS = [
  { value: "shipping", label: "Shipping" },
  { value: "clickncollect", label: "Click & collect" },
  { value: "service_points", label: "Service points" },
];
const FALLBACK_COUNTRY_CODES = [
  "FR",
  "BE",
  "CH",
  "DE",
  "ES",
  "GB",
  "IT",
  "NL",
  "PT",
  "US",
  "CA",
  "AU",
];

function getCountryOptions() {
  if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
    try {
      const values = (Intl as typeof Intl & {
        supportedValuesOf?: (key: string) => string[];
      }).supportedValuesOf?.("region");
      if (Array.isArray(values) && values.length) {
        return values
          .filter((code) => code.length === 2)
          .map((code) => code.toUpperCase())
          .sort();
      }
    } catch {
      // Fallback to default list when runtime doesn't support regions.
    }
  }
  return FALLBACK_COUNTRY_CODES;
}

function getCountryLabel(code: string, locale = "fr") {
  try {
    const display = new Intl.DisplayNames([locale], { type: "region" });
    return display.of(code) ?? code;
  } catch {
    return code;
  }
}

function KeyStatus({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
      Saved
    </span>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default function SettingsClient({ settings }: SettingsClientProps) {
  const [activeMenu, setActiveMenu] = useState<MenuItem>("General");
  const [storeName, setStoreName] = useState(settings.storeName);
  const [domain, setDomain] = useState(settings.domain);
  const [websiteTitle, setWebsiteTitle] = useState(settings.websiteTitle);
  const [websiteDescription, setWebsiteDescription] = useState(
    settings.websiteDescription,
  );
  const [defaultCurrency, setDefaultCurrency] = useState(
    settings.defaultCurrency,
  );
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [logoTransparentUrl, setLogoTransparentUrl] = useState(
    settings.logoTransparentUrl,
  );
  const [logoUploading, setLogoUploading] = useState<"default" | "transparent" | null>(null);
  const [logoError, setLogoError] = useState("");
  const [logoTransparentError, setLogoTransparentError] = useState("");
  const [brevoApiKey, setBrevoApiKey] = useState("");
  const [brevoApiKeyHint, setBrevoApiKeyHint] = useState(
    settings.brevoApiKeyHint,
  );
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripePublishableKeyHint, setStripePublishableKeyHint] = useState(
    settings.stripePublishableKeyHint,
  );
  const [stripeSecretKeyHint, setStripeSecretKeyHint] = useState(
    settings.stripeSecretKeyHint,
  );
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalClientSecret, setPaypalClientSecret] = useState("");
  const [paypalClientIdHint, setPaypalClientIdHint] = useState(
    settings.paypalClientIdHint,
  );
  const [paypalClientSecretHint, setPaypalClientSecretHint] = useState(
    settings.paypalClientSecretHint,
  );
  const [sendcloudPublicKey, setSendcloudPublicKey] = useState("");
  const [sendcloudPrivateKey, setSendcloudPrivateKey] = useState("");
  const [sendcloudPublicKeyHint, setSendcloudPublicKeyHint] = useState(
    settings.sendcloudPublicKeyHint,
  );
  const [sendcloudPrivateKeyHint, setSendcloudPrivateKeyHint] = useState(
    settings.sendcloudPrivateKeyHint,
  );
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("");
  const [googleMapsApiKeyHint, setGoogleMapsApiKeyHint] = useState(
    settings.googleMapsApiKeyHint,
  );
  const [googleMapsCountryCodes, setGoogleMapsCountryCodes] = useState(
    settings.googleMapsCountryCodes,
  );
  const [shippingOptions, setShippingOptions] = useState<ShippingOptionItem[]>([]);
  const [shippingOptionsLoading, setShippingOptionsLoading] = useState(false);
  const [shippingOptionsLoaded, setShippingOptionsLoaded] = useState(false);
  const [shippingOptionsError, setShippingOptionsError] = useState("");
  const [shippingReordering, setShippingReordering] = useState(false);
  const [shippingDialogOpen, setShippingDialogOpen] = useState(false);
  const [shippingCarrier, setShippingCarrier] = useState("");
  const [shippingType, setShippingType] = useState("shipping");
  const [shippingTitle, setShippingTitle] = useState("");
  const [shippingDescription, setShippingDescription] = useState("");
  const [shippingPrice, setShippingPrice] = useState("");
  const [shippingMinTotal, setShippingMinTotal] = useState("");
  const [shippingMaxTotal, setShippingMaxTotal] = useState("");
  const [shippingFormError, setShippingFormError] = useState("");
  const [shippingSaving, setShippingSaving] = useState(false);
  const [editingShippingOptionId, setEditingShippingOptionId] = useState<
    number | null
  >(null);
  const [carrierOptions, setCarrierOptions] = useState<string[]>([]);
  const [carrierOptionsLoading, setCarrierOptionsLoading] = useState(false);
  const [carrierOptionsError, setCarrierOptionsError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userFormError, setUserFormError] = useState("");
  const [userSaving, setUserSaving] = useState(false);

  const isValid = useMemo(
    () => Boolean(storeName.trim() && defaultCurrency.trim()),
    [storeName, defaultCurrency],
  );
  const isUserFormValid = useMemo(
    () => Boolean(userEmail.trim() && userPassword.trim()),
    [userEmail, userPassword],
  );
  const isPriceRangeValid = useMemo(() => {
    const min = shippingMinTotal.trim();
    const max = shippingMaxTotal.trim();
    const minValue = min ? Number.parseFloat(min.replace(",", ".")) : null;
    const maxValue = max ? Number.parseFloat(max.replace(",", ".")) : null;
    if (minValue !== null && (!Number.isFinite(minValue) || minValue < 0)) {
      return false;
    }
    if (maxValue !== null && (!Number.isFinite(maxValue) || maxValue < 0)) {
      return false;
    }
    if (minValue !== null && maxValue !== null && minValue > maxValue) {
      return false;
    }
    return true;
  }, [shippingMinTotal, shippingMaxTotal]);
  const countryOptions = useMemo(() => getCountryOptions(), []);

  const isShippingFormValid = useMemo(
    () =>
      Boolean(
        shippingCarrier.trim() &&
          shippingType.trim() &&
          shippingTitle.trim() &&
          shippingPrice.trim(),
      ) && isPriceRangeValid,
    [shippingCarrier, shippingType, shippingTitle, shippingPrice, isPriceRangeValid],
  );
  const isEditingShippingOption = editingShippingOptionId !== null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  async function handleSubmit() {
    if (!isValid || loading) return;
    setSettingsError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName,
          domain,
          websiteTitle,
          websiteDescription,
          defaultCurrency,
          brevoApiKey,
          stripePublishableKey,
          stripeSecretKey,
          paypalClientId,
          paypalClientSecret,
          sendcloudPublicKey,
          sendcloudPrivateKey,
          googleMapsApiKey,
          googleMapsCountryCodes,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setSettingsError(data?.error || "Failed to save settings.");
        setLoading(false);
        return;
      }
      const nextPublishableHint =
        data?.settings?.stripe_publishable_key_hint?.toString() ?? null;
      const nextSecretHint =
        data?.settings?.stripe_secret_key_hint?.toString() ?? null;
      if (nextPublishableHint !== null) {
        setStripePublishableKeyHint(nextPublishableHint);
      }
      if (nextSecretHint !== null) {
        setStripeSecretKeyHint(nextSecretHint);
      }
      const nextBrevoHint =
        data?.settings?.brevo_api_key_hint?.toString() ?? null;
      if (nextBrevoHint !== null) {
        setBrevoApiKeyHint(nextBrevoHint);
      }
      const nextPaypalClientIdHint =
        data?.settings?.paypal_client_id_hint?.toString() ?? null;
      const nextPaypalClientSecretHint =
        data?.settings?.paypal_client_secret_hint?.toString() ?? null;
      if (nextPaypalClientIdHint !== null) {
        setPaypalClientIdHint(nextPaypalClientIdHint);
      }
      if (nextPaypalClientSecretHint !== null) {
        setPaypalClientSecretHint(nextPaypalClientSecretHint);
      }
      const nextSendcloudPublicHint =
        data?.settings?.sendcloud_public_key_hint?.toString() ?? null;
      const nextSendcloudPrivateHint =
        data?.settings?.sendcloud_private_key_hint?.toString() ?? null;
      if (nextSendcloudPublicHint !== null) {
        setSendcloudPublicKeyHint(nextSendcloudPublicHint);
      }
      if (nextSendcloudPrivateHint !== null) {
        setSendcloudPrivateKeyHint(nextSendcloudPrivateHint);
      }
      const nextGoogleMapsHint =
        data?.settings?.google_maps_api_key_hint?.toString() ?? null;
      if (nextGoogleMapsHint !== null) {
        setGoogleMapsApiKeyHint(nextGoogleMapsHint);
      }
      const nextCountryCodesValue = data?.settings?.google_maps_country_codes;
      if (typeof nextCountryCodesValue === "string") {
        try {
          const parsed = JSON.parse(nextCountryCodesValue);
          if (Array.isArray(parsed)) {
            setGoogleMapsCountryCodes(
              parsed
                .map((code: unknown) => code?.toString().trim().toUpperCase())
                .filter((code: string) => code),
            );
          } else {
            setGoogleMapsCountryCodes([]);
          }
        } catch {
          setGoogleMapsCountryCodes([]);
        }
      } else if (nextCountryCodesValue === null) {
        setGoogleMapsCountryCodes([]);
      }
      if (stripePublishableKey) {
        setStripePublishableKey("");
      }
      if (stripeSecretKey) {
        setStripeSecretKey("");
      }
      if (brevoApiKey) {
        setBrevoApiKey("");
      }
      if (paypalClientId) {
        setPaypalClientId("");
      }
      if (paypalClientSecret) {
        setPaypalClientSecret("");
      }
      if (sendcloudPublicKey) {
        setSendcloudPublicKey("");
      }
      if (sendcloudPrivateKey) {
        setSendcloudPrivateKey("");
      }
      if (googleMapsApiKey) {
        setGoogleMapsApiKey("");
      }
    } catch {
      setSettingsError("Failed to save settings.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadLogo(file: File, variant: "default" | "transparent") {
    if (logoUploading) return;
    if (variant === "default") {
      setLogoError("");
    } else {
      setLogoTransparentError("");
    }
    setLogoUploading(variant);

    try {
      const formData = new FormData();
      formData.append("logo", file);
      formData.append("variant", variant);

      const response = await fetch("/api/admin/settings/logo", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error || "Failed to upload logo.";
        if (variant === "default") {
          setLogoError(message);
        } else {
          setLogoTransparentError(message);
        }
        setLogoUploading(null);
        return;
      }

      const nextUrl = data?.logoUrl?.toString();
      if (nextUrl) {
        if (variant === "default") {
          setLogoUrl(nextUrl);
        } else {
          setLogoTransparentUrl(nextUrl);
        }
      }
    } catch {
      if (variant === "default") {
        setLogoError("Failed to upload logo.");
      } else {
        setLogoTransparentError("Failed to upload logo.");
      }
    } finally {
      setLogoUploading(null);
    }
  }

  function handleLogoChange(
    event: ChangeEvent<HTMLInputElement>,
    variant: "default" | "transparent",
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadLogo(file, variant);
    event.target.value = "";
  }

  function handleLogoDrop(
    event: DragEvent<HTMLLabelElement>,
    variant: "default" | "transparent",
  ) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    uploadLogo(file, variant);
  }

  async function loadUsers() {
    if (usersLoading) return;
    setUsersLoading(true);
    setUsersError("");
    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setUsersError(data?.error || "Failed to load users.");
        setUsersLoading(false);
        return;
      }
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch {
      setUsersError("Failed to load users.");
    } finally {
      setUsersLoading(false);
    }
  }

  async function handleCreateUser() {
    if (!isUserFormValid || userSaving) return;
    setUserFormError("");
    setUserSaving(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userName,
          email: userEmail,
          password: userPassword,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setUserFormError(data?.error || "Failed to create user.");
        setUserSaving(false);
        return;
      }

      if (data?.user) {
        setUsers((prev) => [data.user, ...prev]);
      }
      setUserDialogOpen(false);
      setUserName("");
      setUserEmail("");
      setUserPassword("");
    } catch {
      setUserFormError("Failed to create user.");
    } finally {
      setUserSaving(false);
    }
  }

  useEffect(() => {
    if (activeMenu === "Users" && users.length === 0 && !usersLoading) {
      void loadUsers();
    }
    if (activeMenu !== "Users") {
      setUserDialogOpen(false);
    }
  }, [activeMenu, users.length, usersLoading]);

  useEffect(() => {
    if (
      activeMenu === "Shipping" &&
      !shippingOptionsLoaded &&
      !shippingOptionsLoading
    ) {
      void loadShippingOptions();
    }
  }, [activeMenu, shippingOptionsLoaded, shippingOptionsLoading]);

  useEffect(() => {
    if (!shippingDialogOpen || carrierOptionsLoading) {
      return;
    }
    if (carrierOptions.length === 0) {
      void loadCarrierOptions();
    }
  }, [shippingDialogOpen, carrierOptionsLoading, carrierOptions.length]);

  useEffect(() => {
    if (!shippingDialogOpen) {
      return;
    }
    if (!shippingCarrier) {
      const initial = carrierOptions[0] || "Other";
      setShippingCarrier(initial);
    }
  }, [shippingDialogOpen, shippingCarrier, carrierOptions]);

  const formatCurrency = useMemo(() => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: defaultCurrency || "EUR",
    });
  }, [defaultCurrency]);

  const formatOrderRange = useMemo(() => {
    return (minValue: string | null, maxValue: string | null) => {
      const min = minValue ? Number.parseFloat(minValue) : null;
      const max = maxValue ? Number.parseFloat(maxValue) : null;
      if (min === null && max === null) {
        return "Any";
      }
      if (min !== null && max === null) {
        return `>= ${formatCurrency.format(min)}`;
      }
      if (min === null && max !== null) {
        return `<= ${formatCurrency.format(max)}`;
      }
      if (min !== null && max !== null) {
        return `${formatCurrency.format(min)} - ${formatCurrency.format(max)}`;
      }
      return "Any";
    };
  }, [formatCurrency]);

  const getShippingTypeLabel = (value: string) => {
    if (!value) return "Shipping";
    const match = SHIPPING_TYPE_OPTIONS.find((option) => option.value === value);
    return match ? match.label : value;
  };

  async function loadShippingOptions() {
    if (shippingOptionsLoading) return;
    setShippingOptionsLoading(true);
    setShippingOptionsError("");
    try {
      const response = await fetch("/api/admin/shipping/options");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setShippingOptionsError(data?.error || "Failed to load shipping options.");
        setShippingOptionsLoading(false);
        return;
      }
      setShippingOptions(Array.isArray(data?.options) ? data.options : []);
    } catch {
      setShippingOptionsError("Failed to load shipping options.");
    } finally {
      setShippingOptionsLoaded(true);
      setShippingOptionsLoading(false);
    }
  }

  async function loadCarrierOptions() {
    if (carrierOptionsLoading) return;
    setCarrierOptionsLoading(true);
    setCarrierOptionsError("");
    try {
      const response = await fetch("/api/admin/shipping/carriers");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setCarrierOptionsError(data?.error || "Failed to load carriers.");
        setCarrierOptions(["Other"]);
        setCarrierOptionsLoading(false);
        return;
      }
      const options = Array.isArray(data?.carriers) ? data.carriers : [];
      const unique = new Set<string>();
      options.forEach((option: string) => {
        if (typeof option === "string" && option.trim()) {
          unique.add(option.trim());
        }
      });
      unique.add("Other");
      setCarrierOptions(Array.from(unique));
    } catch {
      setCarrierOptionsError("Failed to load carriers.");
      setCarrierOptions(["Other"]);
    } finally {
      setCarrierOptionsLoading(false);
    }
  }

  function handleEditShippingOption(option: ShippingOptionItem) {
    setEditingShippingOptionId(option.id);
    setShippingCarrier(option.carrier);
    setShippingType(option.shipping_type || "shipping");
    setShippingTitle(option.title);
    setShippingDescription(option.description ?? "");
    setShippingPrice(option.price);
    setShippingMinTotal(option.min_order_total ?? "");
    setShippingMaxTotal(option.max_order_total ?? "");
    setShippingDialogOpen(true);
  }

  async function handleCreateShippingOption() {
    if (!isShippingFormValid || shippingSaving) return;
    setShippingFormError("");
    if (!isPriceRangeValid) {
      setShippingFormError("Minimum order total must be less than the maximum.");
      return;
    }
    setShippingSaving(true);
    try {
      const isEditing = editingShippingOptionId !== null;
      const endpoint = isEditing
        ? `/api/admin/shipping/options/${editingShippingOptionId}`
        : "/api/admin/shipping/options";
      const response = await fetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier: shippingCarrier,
          shippingType,
          title: shippingTitle,
          description: shippingDescription,
          price: shippingPrice,
          minOrderTotal: shippingMinTotal,
          maxOrderTotal: shippingMaxTotal,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setShippingFormError(data?.error || "Failed to create shipping option.");
        setShippingSaving(false);
        return;
      }
      if (data?.option) {
        setShippingOptions((prev) => {
          const next = data.option as ShippingOptionItem;
          if (isEditing) {
            return prev.map((item) => (item.id === next.id ? next : item));
          }
          return [next, ...prev];
        });
      }
      setShippingDialogOpen(false);
      setEditingShippingOptionId(null);
      setShippingCarrier("");
      setShippingType("shipping");
      setShippingTitle("");
      setShippingDescription("");
      setShippingPrice("");
      setShippingMinTotal("");
      setShippingMaxTotal("");
    } catch {
      setShippingFormError("Failed to create shipping option.");
    } finally {
      setShippingSaving(false);
    }
  }

  async function persistShippingOptionOrder(nextOptions: ShippingOptionItem[]) {
    if (shippingReordering) return;
    setShippingReordering(true);
    setShippingOptionsError("");
    try {
      const response = await fetch("/api/admin/shipping/options/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: nextOptions.map((option) => option.id),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setShippingOptionsError(data?.error || "Failed to save order.");
      }
    } catch {
      setShippingOptionsError("Failed to save order.");
    } finally {
      setShippingReordering(false);
    }
  }

  const handleShippingDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) {
      return;
    }
    const oldIndex = shippingOptions.findIndex(
      (option) => option.id === event.active.id,
    );
    const newIndex = shippingOptions.findIndex(
      (option) => option.id === event.over?.id,
    );
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }
    const nextOptions = arrayMove(shippingOptions, oldIndex, newIndex);
    setShippingOptions(nextOptions);
    void persistShippingOptionOrder(nextOptions);
  };

  function ShippingOptionRow({
    option,
  }: {
    option: ShippingOptionItem;
  }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
      useSortable({ id: option.id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <TableRow
        ref={setNodeRef}
        style={style}
        className={isDragging ? "opacity-70" : ""}
      >
        <TableCell className="w-10">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
            aria-label={`Reorder ${option.title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </TableCell>
        <TableCell className="font-medium text-neutral-900">
          {option.carrier}
        </TableCell>
        <TableCell className="text-neutral-600">
          {getShippingTypeLabel(option.shipping_type)}
        </TableCell>
        <TableCell className="text-neutral-700">{option.title}</TableCell>
        <TableCell className="text-neutral-600">
          {option.description || "—"}
        </TableCell>
        <TableCell className="text-neutral-600">
          {formatOrderRange(option.min_order_total, option.max_order_total)}
        </TableCell>
        <TableCell className="text-right text-neutral-700">
          {formatCurrency.format(Number(option.price || 0))}
        </TableCell>
        <TableCell className="text-right">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleEditShippingOption(option)}
            aria-label={`Edit ${option.title}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    );
  }

  const action =
    activeMenu === "Users" ? (
      <DialogTrigger asChild>
        <Button size="sm">Add user</Button>
      </DialogTrigger>
    ) : activeMenu === "General" ||
      activeMenu === "Emailing" ||
      activeMenu === "Payments" ||
      activeMenu === "Shipping" ? (
      <Button size="sm" onClick={handleSubmit} disabled={!isValid || loading}>
        {loading ? "Saving..." : "Save changes"}
      </Button>
    ) : null;

  return (
    <Dialog
      open={userDialogOpen}
      onOpenChange={(open) => {
        setUserDialogOpen(open);
        if (!open) {
          setUserFormError("");
          setUserName("");
          setUserEmail("");
          setUserPassword("");
        }
      }}
    >
      <AdminShell title="Settings" current="settings" action={action}>
        <Card className="border-neutral-200 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="border-neutral-200 px-6 py-6 md:w-56 md:border-r">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
                  Menu
                </p>
                <nav className="mt-4 flex flex-col gap-1">
                  {MENU_ITEMS.map((item) => {
                    const isActive = item === activeMenu;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setActiveMenu(item)}
                        className={`rounded-md px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "bg-neutral-900 text-white"
                            : "text-neutral-600 hover:bg-neutral-100"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </nav>
              </div>
              <div className="flex-1 px-6 py-6">
                {activeMenu === "General" ? (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900">
                        General
                      </h2>
                      <p className="text-sm text-neutral-500">
                        Update your store identity and public details.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <label
                          htmlFor="store-logo"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Logo
                        </label>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <label
                              htmlFor="store-logo"
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) =>
                                handleLogoDrop(event, "default")
                              }
                              className="flex min-h-[120px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500 transition hover:border-neutral-300"
                            >
                              {logoUrl ? (
                                <img
                                  src={logoUrl}
                                  alt="Store logo"
                                  className="max-h-24 w-auto object-contain"
                                />
                              ) : (
                                <div>
                                  <p className="font-medium text-neutral-700">
                                    Drag & drop your logo
                                  </p>
                                  <p className="text-xs text-neutral-400">
                                    or click to browse files
                                  </p>
                                </div>
                              )}
                              <input
                                id="store-logo"
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(event) =>
                                  handleLogoChange(event, "default")
                                }
                                disabled={logoUploading !== null}
                              />
                            </label>
                            {logoUploading === "default" ? (
                              <p className="text-xs text-neutral-500">
                                Uploading logo...
                              </p>
                            ) : null}
                            {logoError ? (
                              <p className="text-xs text-red-600">
                                {logoError}
                              </p>
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            <label
                              htmlFor="store-logo-transparent"
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) =>
                                handleLogoDrop(event, "transparent")
                              }
                              className="flex min-h-[120px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-500 transition hover:border-neutral-300"
                            >
                              {logoTransparentUrl ? (
                                <img
                                  src={logoTransparentUrl}
                                  alt="Transparent logo"
                                  className="max-h-24 w-auto object-contain"
                                />
                              ) : (
                                <div>
                                  <p className="font-medium text-neutral-700">
                                    Upload a transparent logo
                                  </p>
                                  <p className="text-xs text-neutral-400">
                                    or click to browse files
                                  </p>
                                </div>
                              )}
                              <input
                                id="store-logo-transparent"
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(event) =>
                                  handleLogoChange(event, "transparent")
                                }
                                disabled={logoUploading !== null}
                              />
                            </label>
                            {logoUploading === "transparent" ? (
                              <p className="text-xs text-neutral-500">
                                Uploading transparent logo...
                              </p>
                            ) : null}
                            {logoTransparentError ? (
                              <p className="text-xs text-red-600">
                                {logoTransparentError}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-xs text-neutral-500">
                          Recommended: transparent PNG or SVG, 400x200px.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="store-name"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Store name
                        </label>
                        <Input
                          id="store-name"
                          value={storeName}
                          onChange={(event) => setStoreName(event.target.value)}
                          placeholder="Atelier Commerce"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="domain"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Domain
                        </label>
                        <Input
                          id="domain"
                          value={domain}
                          onChange={(event) => setDomain(event.target.value)}
                          placeholder="ateliercommerce.fr"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="website-title"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Website title
                        </label>
                        <Input
                          id="website-title"
                          value={websiteTitle}
                          onChange={(event) =>
                            setWebsiteTitle(event.target.value)
                          }
                          placeholder="Atelier Commerce"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="default-currency"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Default currency
                        </label>
                        <select
                          id="default-currency"
                          value={defaultCurrency}
                          onChange={(event) =>
                            setDefaultCurrency(event.target.value)
                          }
                          className={selectClassName}
                        >
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                          <option value="GBP">GBP</option>
                        </select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="google-maps-key"
                            className="text-sm font-medium text-neutral-700"
                          >
                            Google Maps API key
                          </label>
                          <KeyStatus active={Boolean(googleMapsApiKeyHint)} />
                        </div>
                        <Input
                          id="google-maps-key"
                          type="password"
                          value={googleMapsApiKey}
                          onChange={(event) =>
                            setGoogleMapsApiKey(event.target.value)
                          }
                          placeholder="AIza..."
                          autoComplete="new-password"
                        />
                        <p className="text-xs text-neutral-500">
                          Current key:{" "}
                          {googleMapsApiKeyHint
                            ? `...${googleMapsApiKeyHint}`
                            : "not set"}
                        </p>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label
                          htmlFor="google-maps-countries"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Allowed countries (checkout)
                        </label>
                        <select
                          id="google-maps-countries"
                          multiple
                          value={googleMapsCountryCodes}
                          onChange={(event) => {
                            const selected = Array.from(
                              event.target.selectedOptions,
                            ).map((option) => option.value);
                            setGoogleMapsCountryCodes(selected);
                          }}
                          className={`${selectClassName} min-h-[160px]`}
                        >
                          {countryOptions.map((code) => (
                            <option key={code} value={code}>
                              {getCountryLabel(code)}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-neutral-500">
                          These countries are available at checkout and used to
                          restrict address autocomplete.
                        </p>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label
                          htmlFor="website-description"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Website description
                        </label>
                        <textarea
                          id="website-description"
                          value={websiteDescription}
                          onChange={(event) =>
                            setWebsiteDescription(event.target.value)
                          }
                          placeholder="Describe your store."
                          className="border-input min-h-[96px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                        />
                      </div>
                    </div>

                    {settingsError ? (
                      <p className="text-sm text-red-600">{settingsError}</p>
                    ) : null}
                  </div>
                ) : activeMenu === "Users" ? (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900">
                        Users
                      </h2>
                      <p className="text-sm text-neutral-500">
                        Manage admin access for your team.
                      </p>
                    </div>

                    {usersError ? (
                      <p className="text-sm text-red-600">{usersError}</p>
                    ) : null}

                    <div className="overflow-hidden rounded-lg border border-neutral-200">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usersLoading ? (
                            <TableRow>
                              <TableCell
                                colSpan={3}
                                className="py-6 text-center text-sm text-neutral-500"
                              >
                                Loading users...
                              </TableCell>
                            </TableRow>
                          ) : users.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={3}
                                className="py-6 text-center text-sm text-neutral-500"
                              >
                                No admin users yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            users.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell className="font-medium text-neutral-900">
                                  {user.name || "Admin"}
                                </TableCell>
                                <TableCell className="text-neutral-600">
                                  {user.email}
                                </TableCell>
                                <TableCell className="text-neutral-500">
                                  {user.createdAt
                                    ? formatDateTime(user.createdAt)
                                    : "-"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : activeMenu === "Emailing" ? (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900">
                        Emailing
                      </h2>
                      <p className="text-sm text-neutral-500">
                        Configure the Brevo API key used to send order emails.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="brevo-api-key"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Brevo secret key
                        </label>
                        <KeyStatus active={Boolean(brevoApiKeyHint)} />
                      </div>
                      <Input
                        id="brevo-api-key"
                        type="password"
                        value={brevoApiKey}
                        onChange={(event) => setBrevoApiKey(event.target.value)}
                        placeholder="xkeysib-..."
                        autoComplete="new-password"
                      />
                      <p className="text-xs text-neutral-500">
                        Current key:{" "}
                        {brevoApiKeyHint ? `${brevoApiKeyHint}...` : "not set"}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Keys are stored encrypted and only the last 4 characters are shown.
                      </p>
                    </div>

                    {settingsError ? (
                      <p className="text-sm text-red-600">{settingsError}</p>
                    ) : null}
                  </div>
                ) : activeMenu === "Payments" ? (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900">
                        Payments
                      </h2>
                      <p className="text-sm text-neutral-500">
                        Manage the payment provider keys used for checkout.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-neutral-900">
                        Stripe
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Keys are stored encrypted and only the prefix is shown.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="stripe-publishable-key"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Stripe publishable key
                        </label>
                        <KeyStatus active={Boolean(stripePublishableKeyHint)} />
                      </div>
                      <Input
                        id="stripe-publishable-key"
                        value={stripePublishableKey}
                        onChange={(event) =>
                          setStripePublishableKey(event.target.value)
                        }
                        placeholder="pk_test_..."
                        autoComplete="off"
                      />
                      <p className="text-xs text-neutral-500">
                        Current key:{" "}
                        {stripePublishableKeyHint
                          ? `${stripePublishableKeyHint}...`
                          : "not set"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="stripe-secret-key"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Stripe secret key
                        </label>
                        <KeyStatus active={Boolean(stripeSecretKeyHint)} />
                      </div>
                      <Input
                        id="stripe-secret-key"
                        type="password"
                        value={stripeSecretKey}
                        onChange={(event) =>
                          setStripeSecretKey(event.target.value)
                        }
                        placeholder="sk_test_..."
                        autoComplete="new-password"
                      />
                      <p className="text-xs text-neutral-500">
                        Current key:{" "}
                        {stripeSecretKeyHint
                          ? `${stripeSecretKeyHint}...`
                          : "not set"}
                      </p>
                    </div>

                    <div className="space-y-1 pt-4">
                      <h3 className="text-sm font-semibold text-neutral-900">
                        PayPal
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Keys are stored encrypted and only the prefix is shown.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="paypal-client-id"
                          className="text-sm font-medium text-neutral-700"
                        >
                          PayPal client ID
                        </label>
                        <KeyStatus active={Boolean(paypalClientIdHint)} />
                      </div>
                      <Input
                        id="paypal-client-id"
                        value={paypalClientId}
                        onChange={(event) => setPaypalClientId(event.target.value)}
                        placeholder="AR..."
                        autoComplete="off"
                      />
                      <p className="text-xs text-neutral-500">
                        Current key:{" "}
                        {paypalClientIdHint ? `${paypalClientIdHint}...` : "not set"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="paypal-client-secret"
                          className="text-sm font-medium text-neutral-700"
                        >
                          PayPal client secret
                        </label>
                        <KeyStatus active={Boolean(paypalClientSecretHint)} />
                      </div>
                      <Input
                        id="paypal-client-secret"
                        type="password"
                        value={paypalClientSecret}
                        onChange={(event) =>
                          setPaypalClientSecret(event.target.value)
                        }
                        placeholder="E..."
                        autoComplete="new-password"
                      />
                      <p className="text-xs text-neutral-500">
                        Current key:{" "}
                        {paypalClientSecretHint
                          ? `${paypalClientSecretHint}...`
                          : "not set"}
                      </p>
                    </div>

                    {settingsError ? (
                      <p className="text-sm text-red-600">{settingsError}</p>
                    ) : null}
                  </div>
                ) : activeMenu === "Shipping" ? (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900">
                        Shipping
                      </h2>
                      <p className="text-sm text-neutral-500">
                        Store Sendcloud keys and manage your shipping options.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="sendcloud-public-key"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Sendcloud public key
                        </label>
                        <KeyStatus active={Boolean(sendcloudPublicKeyHint)} />
                      </div>
                      <Input
                        id="sendcloud-public-key"
                        value={sendcloudPublicKey}
                        onChange={(event) =>
                          setSendcloudPublicKey(event.target.value)
                        }
                        placeholder="aa..."
                        autoComplete="off"
                      />
                      <p className="text-xs text-neutral-500">
                        Current key:{" "}
                        {sendcloudPublicKeyHint
                          ? `...${sendcloudPublicKeyHint}`
                          : "not set"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="sendcloud-private-key"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Sendcloud private key
                        </label>
                        <KeyStatus active={Boolean(sendcloudPrivateKeyHint)} />
                      </div>
                      <Input
                        id="sendcloud-private-key"
                        type="password"
                        value={sendcloudPrivateKey}
                        onChange={(event) =>
                          setSendcloudPrivateKey(event.target.value)
                        }
                        placeholder="c2..."
                        autoComplete="new-password"
                      />
                      <p className="text-xs text-neutral-500">
                        Current key:{" "}
                        {sendcloudPrivateKeyHint
                          ? `...${sendcloudPrivateKeyHint}`
                          : "not set"}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Keys are stored encrypted and only the prefix is shown.
                      </p>
                    </div>

                    <Dialog
                      open={shippingDialogOpen}
                      onOpenChange={(open) => {
                        setShippingDialogOpen(open);
                        if (!open) {
                          setShippingFormError("");
                          setEditingShippingOptionId(null);
                          setShippingCarrier("");
                          setShippingType("shipping");
                          setShippingTitle("");
                          setShippingDescription("");
                          setShippingPrice("");
                          setShippingMinTotal("");
                          setShippingMaxTotal("");
                        }
                      }}
                    >
                      <div className="space-y-3 pt-2">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-neutral-900">
                              Shipping options
                            </h3>
                            <p className="text-xs text-neutral-500">
                              Create the options displayed at checkout.
                            </p>
                          </div>
                        </div>

                        {shippingOptionsError ? (
                          <p className="text-sm text-red-600">
                            {shippingOptionsError}
                          </p>
                        ) : null}

                        <div className="rounded-md border border-neutral-200">
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleShippingDragEnd}
                          >
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-10" />
                                  <TableHead>Carrier</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Title</TableHead>
                                  <TableHead>Description</TableHead>
                                  <TableHead>Order total</TableHead>
                                  <TableHead className="text-right">Price</TableHead>
                                  <TableHead className="text-right">Edit</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {shippingOptionsLoading ? (
                                  <TableRow>
                                    <TableCell
                                      colSpan={8}
                                      className="py-6 text-center text-sm text-neutral-500"
                                    >
                                      Loading shipping options...
                                    </TableCell>
                                  </TableRow>
                                ) : shippingOptions.length === 0 ? (
                                  <TableRow>
                                    <TableCell
                                      colSpan={8}
                                      className="py-6 text-center text-sm text-neutral-500"
                                    >
                                      No shipping options yet.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  <SortableContext
                                    items={shippingOptions.map((option) => option.id)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {shippingOptions.map((option) => (
                                      <ShippingOptionRow
                                        key={option.id}
                                        option={option}
                                      />
                                    ))}
                                  </SortableContext>
                                )}
                              </TableBody>
                            </Table>
                          </DndContext>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            type="button"
                            onClick={() => {
                              setEditingShippingOptionId(null);
                              setShippingCarrier("");
                              setShippingType("shipping");
                              setShippingTitle("");
                              setShippingDescription("");
                              setShippingPrice("");
                              setShippingMinTotal("");
                              setShippingMaxTotal("");
                              setShippingDialogOpen(true);
                            }}
                          >
                            Add shipping option
                          </Button>
                        </div>
                      </div>

                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>
                            {isEditingShippingOption
                              ? "Edit shipping option"
                              : "New shipping option"}
                          </DialogTitle>
                          <DialogDescription>
                            {isEditingShippingOption
                              ? "Update the option details."
                              : "Choose a carrier and provide the option details."}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label
                              htmlFor="shipping-carrier"
                              className="text-sm font-medium text-neutral-700"
                            >
                              Carrier
                            </label>
                            <select
                              id="shipping-carrier"
                              value={shippingCarrier}
                              onChange={(event) =>
                                setShippingCarrier(event.target.value)
                              }
                              className={selectClassName}
                              disabled={carrierOptionsLoading}
                            >
                              {(carrierOptions.length > 0
                                ? carrierOptions
                                : ["Other"]
                              )
                                .concat(
                                  shippingCarrier &&
                                    !carrierOptions.includes(shippingCarrier)
                                    ? [shippingCarrier]
                                    : [],
                                )
                                .filter((option, index, list) => list.indexOf(option) === index)
                                .map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                            </select>
                            {carrierOptionsLoading ? (
                              <p className="text-xs text-neutral-500">
                                Loading carriers...
                              </p>
                            ) : null}
                            {carrierOptionsError ? (
                              <p className="text-xs text-red-600">
                                {carrierOptionsError}
                              </p>
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            <label
                              htmlFor="shipping-type"
                              className="text-sm font-medium text-neutral-700"
                            >
                              Type
                            </label>
                            <select
                              id="shipping-type"
                              value={shippingType}
                              onChange={(event) => setShippingType(event.target.value)}
                              className={selectClassName}
                            >
                              {SHIPPING_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label
                              htmlFor="shipping-title"
                              className="text-sm font-medium text-neutral-700"
                            >
                              Title
                            </label>
                            <Input
                              id="shipping-title"
                              value={shippingTitle}
                              onChange={(event) =>
                                setShippingTitle(event.target.value)
                              }
                              placeholder="Standard delivery"
                            />
                          </div>
                          <div className="space-y-2">
                            <label
                              htmlFor="shipping-description"
                              className="text-sm font-medium text-neutral-700"
                            >
                              Description
                            </label>
                            <textarea
                              id="shipping-description"
                              value={shippingDescription}
                              onChange={(event) =>
                                setShippingDescription(event.target.value)
                              }
                              placeholder="Delivered in 3-5 business days."
                              className="border-input min-h-[96px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                            />
                          </div>
                          <div className="space-y-2">
                            <label
                              htmlFor="shipping-price"
                              className="text-sm font-medium text-neutral-700"
                            >
                              Price
                            </label>
                            <Input
                              id="shipping-price"
                              type="number"
                              min="0"
                              step="0.01"
                              value={shippingPrice}
                              onChange={(event) =>
                                setShippingPrice(event.target.value)
                              }
                              placeholder="9.90"
                            />
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <label
                                htmlFor="shipping-min-total"
                                className="text-sm font-medium text-neutral-700"
                              >
                                Min order total
                              </label>
                              <Input
                                id="shipping-min-total"
                                type="number"
                                min="0"
                                step="0.01"
                                value={shippingMinTotal}
                                onChange={(event) =>
                                  setShippingMinTotal(event.target.value)
                                }
                                placeholder="0.00"
                              />
                            </div>
                            <div className="space-y-2">
                              <label
                                htmlFor="shipping-max-total"
                                className="text-sm font-medium text-neutral-700"
                              >
                                Max order total
                              </label>
                              <Input
                                id="shipping-max-total"
                                type="number"
                                min="0"
                                step="0.01"
                                value={shippingMaxTotal}
                                onChange={(event) =>
                                  setShippingMaxTotal(event.target.value)
                                }
                                placeholder="50.00"
                              />
                            </div>
                          </div>
                          {!isPriceRangeValid ? (
                            <p className="text-sm text-red-600">
                              Minimum order total must be less than the maximum.
                            </p>
                          ) : null}
                          {shippingFormError ? (
                            <p className="text-sm text-red-600">
                              {shippingFormError}
                            </p>
                          ) : null}
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShippingDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              onClick={handleCreateShippingOption}
                              disabled={!isShippingFormValid || shippingSaving}
                            >
                              {shippingSaving
                                ? "Saving..."
                                : isEditingShippingOption
                                  ? "Save changes"
                                  : "Create option"}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {settingsError ? (
                      <p className="text-sm text-red-600">{settingsError}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-neutral-900">
                      {activeMenu}
                    </h2>
                    <p className="text-sm text-neutral-500">
                      Settings for this section will be available soon.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </AdminShell>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add admin user</DialogTitle>
          <DialogDescription>
            Create a new login for the back office.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="user-name"
              className="text-sm font-medium text-neutral-700"
            >
              Name (optional)
            </label>
            <Input
              id="user-name"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              placeholder="Admin"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="user-email"
              className="text-sm font-medium text-neutral-700"
            >
              Email
            </label>
            <Input
              id="user-email"
              type="email"
              value={userEmail}
              onChange={(event) => setUserEmail(event.target.value)}
              placeholder="admin@ateliercommerce.fr"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="user-password"
              className="text-sm font-medium text-neutral-700"
            >
              Password
            </label>
            <Input
              id="user-password"
              type="password"
              value={userPassword}
              onChange={(event) => setUserPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>
          {userFormError ? (
            <p className="text-sm text-red-600">{userFormError}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUserDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateUser}
              disabled={!isUserFormValid || userSaving}
            >
              {userSaving ? "Saving..." : "Add user"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
