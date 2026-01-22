"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useCart } from "@/components/storefront/cart-context";
import ProductVariantsClient from "@/app/produit/[slug]/ProductVariantsClient";

type ProductVariantOption = {
  name: string;
  values: string[];
};

type VariantImageMapping = {
  option: string;
  value: string;
  imageUrl: string;
};

type ProductPurchaseClientProps = {
  product: {
    id: number;
    slug: string;
    title: string;
    priceCents: number;
    imageUrl: string | null;
  };
  inStock: boolean;
  options: ProductVariantOption[];
  variantImages?: VariantImageMapping[];
  onImageChange?: (url: string | null) => void;
};

export default function ProductPurchaseClient({
  product,
  inStock,
  options,
  variantImages,
  onImageChange,
}: ProductPurchaseClientProps) {
  const { addItem, openCart } = useCart();
  const [buttonState, setButtonState] = useState<"idle" | "loading" | "success">(
    "idle",
  );
  const timersRef = useRef<number[]>([]);
  const initialSelections = useMemo(() => {
    const entries = options
      .map((option) => [option.name, option.values[0] ?? ""] as const)
      .filter(([, value]) => value);
    return Object.fromEntries(entries) as Record<string, string>;
  }, [options]);

  const [selectedVariants, setSelectedVariants] = useState<
    Record<string, string>
  >(initialSelections);

  const variantImageMap = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    (variantImages ?? []).forEach((entry) => {
      const optionName = entry.option?.toString().trim() ?? "";
      const value = entry.value?.toString().trim() ?? "";
      const imageUrl = entry.imageUrl?.toString().trim() ?? "";
      if (!optionName || !value || !imageUrl) return;
      const values = map.get(optionName) ?? new Map<string, string>();
      values.set(value, imageUrl);
      map.set(optionName, values);
    });
    return map;
  }, [variantImages]);

  const selectedImageUrl = useMemo(() => {
    for (const option of options) {
      const selectedValue = selectedVariants[option.name];
      if (!selectedValue) continue;
      const optionMap = variantImageMap.get(option.name);
      const imageUrl = optionMap?.get(selectedValue);
      if (imageUrl) return imageUrl;
    }
    return product.imageUrl;
  }, [options, product.imageUrl, selectedVariants, variantImageMap]);

  const variantLabel = useMemo(() => {
    const entries = Object.entries(selectedVariants).filter(([, value]) => value);
    if (entries.length === 0) return undefined;
    return entries.map(([, value]) => value).join(", ");
  }, [selectedVariants]);

  useEffect(() => {
    onImageChange?.(selectedImageUrl ?? null);
  }, [onImageChange, selectedImageUrl]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  function resetTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function handleAddToCart() {
    if (!inStock || buttonState !== "idle") return;
    addItem({
      id: product.id,
      slug: product.slug,
      title: product.title,
      priceCents: product.priceCents,
      imageUrl: selectedImageUrl ?? product.imageUrl,
      variantLabel,
    });
    resetTimers();
    setButtonState("loading");
    timersRef.current.push(
      window.setTimeout(() => {
        setButtonState("success");
      }, 700),
    );
    timersRef.current.push(
      window.setTimeout(() => {
        setButtonState("idle");
        openCart();
      }, 2200),
    );
  }

  return (
    <div className="space-y-6">
      <ProductVariantsClient
        options={options}
        onSelectionChange={setSelectedVariants}
      />
      <motion.button
        type="button"
        disabled={!inStock || buttonState !== "idle"}
        onClick={handleAddToCart}
        className="cart-cta relative h-14 w-full rounded-none bg-black px-4 text-sm uppercase text-white disabled:cursor-not-allowed"
        aria-live="polite"
        aria-label="Ajouter au panier"
        whileTap={{ scale: 0.98 }}
      >
        <span className="sr-only">Ajouter au panier</span>
        <span className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            {buttonState === "idle" ? (
              <motion.span
                key="idle"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                Ajouter au panier
              </motion.span>
            ) : null}
            {buttonState === "loading" ? (
              <motion.span
                key="loading"
                className="flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.2 }}
              >
                <motion.svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-white"
                  fill="none"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="42 18"
                  />
                </motion.svg>
              </motion.span>
            ) : null}
            {buttonState === "success" ? (
              <motion.span
                key="success"
                className="flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.2 }}
              >
                <motion.svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.35 }}
                >
                  <polyline points="21 5 9 17 3 11" />
                </motion.svg>
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      </motion.button>
    </div>
  );
}
