"use client";

import { useMemo, useState } from "react";

import { useCart } from "@/components/storefront/cart-context";
import ProductVariantsClient from "@/app/produit/[slug]/ProductVariantsClient";

type ProductVariantOption = {
  name: string;
  values: string[];
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
};

export default function ProductPurchaseClient({
  product,
  inStock,
  options,
}: ProductPurchaseClientProps) {
  const { addItem } = useCart();
  const initialSelections = useMemo(() => {
    const entries = options
      .map((option) => [option.name, option.values[0] ?? ""] as const)
      .filter(([, value]) => value);
    return Object.fromEntries(entries) as Record<string, string>;
  }, [options]);

  const [selectedVariants, setSelectedVariants] = useState<
    Record<string, string>
  >(initialSelections);

  const variantLabel = useMemo(() => {
    const entries = Object.entries(selectedVariants).filter(([, value]) => value);
    if (entries.length === 0) return undefined;
    return entries.map(([, value]) => value).join(", ");
  }, [selectedVariants]);

  function handleAddToCart() {
    if (!inStock) return;
    addItem({
      id: product.id,
      slug: product.slug,
      title: product.title,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl,
      variantLabel,
    });
  }

  return (
    <div className="space-y-6">
      <ProductVariantsClient
        options={options}
        onSelectionChange={setSelectedVariants}
      />
      <button
        type="button"
        disabled={!inStock}
        onClick={handleAddToCart}
        className="w-full rounded-none bg-black py-3 text-sm uppercase text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        Ajouter au panier
      </button>
    </div>
  );
}
