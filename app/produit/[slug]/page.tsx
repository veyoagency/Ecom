import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { Op } from "sequelize";

import ProductDetailClient from "@/app/produit/[slug]/ProductDetailClient";
import StorefrontCartProvider from "@/components/storefront/StorefrontCartProvider";
import ProductCard from "@/components/storefront/ProductCard";
import StoreFooterServer from "@/components/storefront/StoreFooterServer";
import StoreHeaderServer from "@/components/storefront/StoreHeaderServer";
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
              attributes: ["id", "value", "position", "image_url"],
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
      values?: Array<{
        value: string;
        position: number | null;
        image_url?: string | null;
      }>;
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

  const variantImages = (productJson.options ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .flatMap((option) =>
      (option.values ?? [])
        .filter((value) => value.image_url)
        .map((value) => ({
          option: option.name,
          value: value.value,
          imageUrl: value.image_url as string,
        })),
    );

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
            <ProductDetailClient
              product={{
                id: Number(productJson.id),
                slug: productJson.slug,
                title: productJson.title,
                priceCents: productJson.price_cents,
                imageUrl: primaryImage,
                descriptionHtml: productJson.description_html ?? null,
              }}
              inStock={productJson.in_stock ?? true}
              options={options}
              images={images}
              variantImages={variantImages}
            />

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
