import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { Op } from "sequelize";

import ProductPurchaseClient from "@/app/produit/[slug]/ProductPurchaseClient";
import StorefrontCartProvider from "@/components/storefront/StorefrontCartProvider";
import ProductCard from "@/components/storefront/ProductCard";
import StoreFooterServer from "@/components/storefront/StoreFooterServer";
import StoreHeaderServer from "@/components/storefront/StoreHeaderServer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collection,
  Product,
  ProductImage,
  ProductOption,
  ProductOptionValue,
} from "@/lib/models";

const futura = localFont({
  src: [
    {
      path: "../../../public/fonts/FuturaPT-Book.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../public/fonts/FuturaPT-Book.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../public/fonts/FuturaPT-Book.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
});

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

function inferMediaKind(url: string): "image" | "video" {
  return /\.(mp4|webm|mov)$/i.test(url) ? "video" : "image";
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await Product.findOne({
    attributes: [
      "id",
      "title",
      "slug",
      "description_html",
      "price_cents",
      "compare_at_cents",
      "active",
      "in_stock",
    ],
    where: { slug },
    include: [
      {
        model: ProductImage,
        as: "images",
        attributes: ["url", "position"],
        required: false,
      },
      {
        model: ProductOption,
        as: "options",
        attributes: ["id", "name", "position"],
        required: false,
        include: [
          {
            model: ProductOptionValue,
            as: "values",
            attributes: ["id", "value", "position"],
            required: false,
          },
        ],
      },
      {
        model: Collection,
        as: "collections",
        attributes: ["id", "title", "slug", "listing_active"],
        through: { attributes: [] },
        required: false,
      },
    ],
  });

  if (!product) {
    notFound();
  }

  const productJson = product.toJSON() as {
    id: number;
    title: string;
    slug: string;
    description_html: string | null;
    price_cents: number;
    compare_at_cents: number | null;
    in_stock?: boolean;
    images?: Array<{ url: string; position: number | null }>;
    options?: Array<{
      name: string;
      position: number | null;
      values?: Array<{ value: string; position: number | null }>;
    }>;
    collections?: Array<{
      id: number;
      title: string;
      slug: string | null;
      listing_active?: boolean;
    }>;
  };

  const images = (productJson.images ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((image) => ({
      url: image.url,
      kind: inferMediaKind(image.url),
    }));
  const primaryImage = images[0]?.url ?? null;

  const options = (productJson.options ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((option) => ({
      name: option.name,
      values: (option.values ?? [])
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((value) => value.value),
    }))
    .filter((option) => option.name && option.values.length > 0);

  const collections = productJson.collections ?? [];
  const relatedCollection = collections.find(
    (collection) => collection.listing_active !== false,
  );
  const relatedProducts = relatedCollection
    ? await Product.findAll({
        attributes: ["id", "title", "slug", "price_cents", "created_at"],
        where: { id: { [Op.ne]: productJson.id } },
        include: [
          {
            model: Collection,
            as: "collections",
            attributes: [],
            through: { attributes: [] },
            where: { id: relatedCollection.id },
          },
          {
            model: ProductImage,
            as: "images",
            attributes: ["url", "position"],
            required: false,
          },
        ],
        order: [
          ["created_at", "DESC"],
          [{ model: ProductImage, as: "images" }, "position", "ASC"],
        ],
        limit: 8,
        distinct: true,
      })
    : [];

  const relatedItems = relatedProducts.map((related) => {
    const relatedJson = related.toJSON() as {
      id: number;
      title: string;
      slug: string;
      price_cents: number;
      images?: Array<{ url: string; position: number | null }>;
    };
    const relatedImages = relatedJson.images ?? [];
    const firstImage = relatedImages
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
    return {
      id: Number(relatedJson.id),
      title: relatedJson.title,
      slug: relatedJson.slug,
      priceLabel: formatPrice(relatedJson.price_cents),
      imageUrl: firstImage?.url ?? null,
    };
  });

  return (
    <StorefrontCartProvider>
      <div
        className={`storefront ${futura.className} min-h-screen bg-neutral-50 text-neutral-900`}
      >
        <StoreHeaderServer fontClassName={futura.className} />
        <main className="bg-white py-5">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-8 px-0 sm:px-6">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="no-scrollbar flex gap-4 overflow-x-auto snap-x snap-mandatory">
              {images.length === 0 ? (
                <div className="aspect-[4/5] min-w-[85%] snap-start bg-neutral-100 sm:min-w-[70%] lg:min-w-full" />
              ) : (
                images.map((media, index) => (
                  <div
                    key={`${media.url}-${index}`}
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
                        alt={productJson.title}
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
                  {productJson.title}
                </h1>
                <p className="text-lg text-black">
                  {formatPrice(productJson.price_cents)}
                </p>
                <div className="flex items-center gap-2 text-sm text-neutral-700">
                  <span
                    className={`inline-flex ${
                      productJson.in_stock ? "text-emerald-500" : "text-red-500"
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
                  {productJson.in_stock ? "En stock" : "Rupture de stock"}
                </div>
              </div>

              <ProductPurchaseClient
                product={{
                  id: Number(productJson.id),
                  slug: productJson.slug,
                  title: productJson.title,
                  priceCents: productJson.price_cents,
                  imageUrl: primaryImage,
                }}
                inStock={productJson.in_stock ?? true}
                options={options}
              />

              {productJson.description_html ? (
                <div
                  className="space-y-3 text-sm text-[#767676] [&>p]:mb-3"
                  dangerouslySetInnerHTML={{
                    __html: productJson.description_html,
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

          {relatedItems.length > 0 ? (
            <section className="space-y-4 px-4 sm:px-0">
              <h2 className="text-[20px] text-black lg:text-[24px]">
                Dans la meme collection
              </h2>
              <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
                {relatedItems.map((related) => (
                  <ProductCard
                    key={related.id}
                    name={related.title}
                    price={related.priceLabel}
                    imageUrl={related.imageUrl}
                    href={`/produit/${related.slug}`}
                  />
                ))}
              </div>
            </section>
          ) : null}
          </div>
        </main>
        <StoreFooterServer fontClassName={futura.className} />
      </div>
    </StorefrontCartProvider>
  );
}
