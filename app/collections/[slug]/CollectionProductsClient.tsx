"use client";

import { useMemo, useState } from "react";

import CollectionFilterDrawer from "@/components/storefront/CollectionFilterDrawer";
import ProductCard from "@/components/storefront/ProductCard";

type CollectionProductItem = {
  id: number;
  title: string;
  priceLabel: string;
  priceCents: number;
  slug: string;
  imageUrl: string | null;
  inStock: boolean;
};

type CollectionProductsClientProps = {
  title: string;
  items: CollectionProductItem[];
  maxPriceLabel: string;
};

export default function CollectionProductsClient({
  title,
  items,
  maxPriceLabel,
}: CollectionProductsClientProps) {
  const [availability, setAvailability] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sort, setSort] = useState("best");

  const parsePriceInput = (value: string) => {
    const normalized = value.replace(",", ".").trim();
    if (!normalized) return null;
    const numberValue = Number(normalized);
    return Number.isFinite(numberValue) ? numberValue : null;
  };

  const filteredItems = useMemo(() => {
    const wantsInStock = availability.includes("in_stock");
    const wantsOutOfStock = availability.includes("out_of_stock");
    const minValue = parsePriceInput(priceMin);
    const maxValue = parsePriceInput(priceMax);
    const minCents = minValue !== null ? Math.round(minValue * 100) : null;
    const maxCents = maxValue !== null ? Math.round(maxValue * 100) : null;

    const filtered = items.filter((item) => {
      if (wantsInStock && !wantsOutOfStock && !item.inStock) return false;
      if (!wantsInStock && wantsOutOfStock && item.inStock) return false;
      if (minCents !== null && item.priceCents < minCents) return false;
      if (maxCents !== null && item.priceCents > maxCents) return false;
      return true;
    });

    if (sort === "best") {
      return filtered;
    }

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "za") {
        return b.title.localeCompare(a.title, "fr", { sensitivity: "base" });
      }
      if (sort === "price_asc") {
        return a.priceCents - b.priceCents;
      }
      if (sort === "price_desc") {
        return b.priceCents - a.priceCents;
      }
      return a.title.localeCompare(a.title, "fr", { sensitivity: "base" });
    });

    return sorted;
  }, [availability, items, priceMax, priceMin, sort]);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-0">
      <h1 className="text-center text-[30px] text-black lg:text-[32px]">
        {title}
      </h1>
      <div className="flex justify-start">
        <CollectionFilterDrawer
          count={filteredItems.length}
          maxPriceLabel={maxPriceLabel}
          availability={availability}
          onAvailabilityChange={setAvailability}
          priceMin={priceMin}
          priceMax={priceMax}
          onPriceMinChange={setPriceMin}
          onPriceMaxChange={setPriceMax}
          sort={sort}
          onSortChange={setSort}
        />
      </div>
      {filteredItems.length === 0 ? (
        <p className="text-center text-sm text-[#767676]">
          Aucun produit dans cette collection.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-y-6 sm:gap-6 lg:grid-cols-4">
          {filteredItems.map((product) => (
            <ProductCard
              key={product.id}
              name={product.title}
              price={product.priceLabel}
              imageUrl={product.imageUrl}
              href={`/produit/${product.slug}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
