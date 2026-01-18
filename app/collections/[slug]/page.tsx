import localFont from "next/font/local";
import { notFound } from "next/navigation";

import CollectionProductsClient from "@/app/collections/[slug]/CollectionProductsClient";
import StoreFooterServer from "@/components/storefront/StoreFooterServer";
import StoreHeaderServer from "@/components/storefront/StoreHeaderServer";
import { Collection, Product, ProductImage } from "@/lib/models";

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

function formatPriceWithSymbol(cents: number) {
  return `€${formatPriceValue(cents)}`;
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await Collection.findOne({
    attributes: ["id", "title", "slug"],
    where: { slug },
  });

  if (!collection) {
    notFound();
  }

  const products = await Product.findAll({
    attributes: ["id", "title", "slug", "price_cents", "created_at", "in_stock"],
    include: [
      {
        model: Collection,
        as: "collections",
        attributes: [],
        through: { attributes: [] },
        where: { id: collection.id },
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
    distinct: true,
  });

  const items = products.map((product) => {
    const productJson = product.toJSON() as {
      id: number;
      title: string;
      slug: string;
      price_cents: number;
      in_stock?: boolean;
      images?: Array<{ url: string; position: number | null }>;
    };
    const images = productJson.images ?? [];
    const firstImage = images
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
    return {
      id: Number(productJson.id),
      title: productJson.title,
      slug: productJson.slug,
      priceCents: productJson.price_cents,
      priceLabel: formatPrice(productJson.price_cents),
      inStock: productJson.in_stock ?? true,
      imageUrl: firstImage?.url ?? null,
    };
  });
  const maxPriceCents = items.reduce(
    (max, item) => Math.max(max, item.priceCents),
    0,
  );
  const maxPriceLabel = formatPriceWithSymbol(maxPriceCents);

  return (
    <div
      className={`storefront ${futura.className} min-h-screen bg-neutral-50 text-neutral-900`}
    >
      <StoreHeaderServer fontClassName={futura.className} />
      <main className="bg-white py-10">
        <CollectionProductsClient
          title={collection.title}
          items={items}
          maxPriceLabel={maxPriceLabel}
        />
      </main>
      <StoreFooterServer fontClassName={futura.className} />
    </div>
  );
}
