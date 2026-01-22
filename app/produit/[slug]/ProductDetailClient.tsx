"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import ProductPurchaseClient from "@/app/produit/[slug]/ProductPurchaseClient";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type ProductVariantOption = {
  name: string;
  values: string[];
};

type VariantImageMapping = {
  option: string;
  value: string;
  imageUrl: string;
};

type ProductMedia = {
  url: string;
  kind: "image" | "video";
};

type ProductDetailClientProps = {
  product: {
    id: number;
    slug: string;
    title: string;
    priceCents: number;
    imageUrl: string | null;
    descriptionHtml: string | null;
  };
  inStock: boolean;
  options: ProductVariantOption[];
  images: ProductMedia[];
  variantImages: VariantImageMapping[];
};

function formatPriceValue(cents: number) {
  const value = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return value.replace(/\u00a0|\u202f/g, " ");
}

function formatPrice(cents: number) {
  return `${formatPriceValue(cents)}€`;
}

export default function ProductDetailClient({
  product,
  inStock,
  options,
  images,
  variantImages,
}: ProductDetailClientProps) {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(
    product.imageUrl,
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const imageRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!selectedImageUrl) return;
    const node = imageRefs.current.get(selectedImageUrl);
    const container = scrollRef.current;
    if (!node || !container) return;
    const containerRect = container.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const left = nodeRect.left - containerRect.left + container.scrollLeft;
    container.scrollTo({ left, behavior: "smooth" });
  }, [selectedImageUrl]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div
        ref={scrollRef}
        className="no-scrollbar flex gap-4 overflow-x-auto snap-x snap-mandatory"
      >
        {images.length === 0 ? (
          <div className="aspect-[4/5] min-w-[85%] snap-start bg-neutral-100 sm:min-w-[70%] lg:min-w-full" />
        ) : (
          images.map((media, index) => (
            <div
              key={`${media.url}-${index}`}
              ref={(node) => {
                if (node) {
                  imageRefs.current.set(media.url, node);
                } else {
                  imageRefs.current.delete(media.url);
                }
              }}
              className="min-w-[85%] snap-start sm:min-w-[70%] lg:min-w-full"
            >
              {media.kind === "video" ? (
                <video
                  src={media.url}
                  controls
                  className="aspect-[4/5] w-full bg-white object-cover"
                />
              ) : (
                <img
                  src={media.url}
                  alt={product.title}
                  className="aspect-[4/5] w-full bg-white object-cover"
                />
              )}
            </div>
          ))
        )}
      </div>
      <div className="flex flex-col gap-6 px-4 sm:px-0">
        <div className="space-y-2">
          <h1 className="text-[28px] text-black lg:text-[32px]">
            {product.title}
          </h1>
          <p className="text-lg text-black">{formatPrice(product.priceCents)}</p>
          <div className="flex items-center gap-2 text-sm text-neutral-700">
            <span
              className={`inline-flex ${
                inStock ? "text-emerald-500" : "text-red-500"
              }`}
              aria-hidden="true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 15 15"
                fill="none"
                width="15"
                height="15"
              >
                <circle cx="7.5" cy="7.5" r="7.5" fill="currentColor" />
                <circle
                  cx="7.5"
                  cy="7.5"
                  r="5"
                  fill="currentColor"
                  stroke="#FFF"
                />
              </svg>
            </span>
            {inStock ? "En stock" : "Rupture de stock"}
          </div>
        </div>

        <ProductPurchaseClient
          product={{
            id: product.id,
            slug: product.slug,
            title: product.title,
            priceCents: product.priceCents,
            imageUrl: product.imageUrl,
          }}
          inStock={inStock}
          options={options}
          variantImages={variantImages}
          onImageChange={setSelectedImageUrl}
        />

        {product.descriptionHtml ? (
          <div
            className="space-y-3 text-sm text-[#767676] [&>p]:mb-3"
            dangerouslySetInnerHTML={{
              __html: product.descriptionHtml,
            }}
          />
        ) : null}

        <Accordion type="single" collapsible className="border-t border-neutral-200">
          {[
            {
              title: "Details du produit",
              content:
                "Chaque piece est concue avec des finitions soignées et un confort optimal.",
            },
            {
              title: "Lavage & entretien",
              content:
                "Lavage en machine a 30° recommande. Evitez le seche-linge.",
            },
            {
              title: "Taille",
              content:
                "Consultez notre guide des tailles pour choisir votre coupe ideale.",
            },
            {
              title: "Livraison",
              content:
                "Livraison en France sous 2 a 5 jours ouvres apres expedition.",
            },
          ].map((item) => (
            <AccordionItem
              key={item.title}
              value={item.title}
              className="border-neutral-200"
            >
              <AccordionTrigger className="text-xs font-normal uppercase text-neutral-900 hover:no-underline">
                {item.title}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-[#767676]">
                {item.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
