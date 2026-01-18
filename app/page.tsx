import localFont from "next/font/local";
import type { Metadata } from "next";

import CollectionCard from "@/components/storefront/CollectionCard";
import ProductCard from "@/components/storefront/ProductCard";
import StoreHeaderServer from "@/components/storefront/StoreHeaderServer";
import { Collection, Product, ProductImage, WebsiteSetting } from "@/lib/models";

function formatPrice(cents: number) {
  const value = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `${value.replace(/\u00a0|\u202f/g, " ")}€`;
}

const futura = localFont({
  src: [
    {
      path: "../public/fonts/FuturaPT-Book.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/FuturaPT-Book.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/FuturaPT-Book.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await WebsiteSetting.findOne();
  const title =
    settings?.website_title?.trim() || settings?.store_name?.trim() || "New Commerce";

  return {
    title,
  };
}

export default async function Home() {
  const collections = await Collection.findAll({
    attributes: ["id", "title", "image_url"],
    order: [["title", "ASC"]],
  });
  const nouveautesCollection = await Collection.findOne({
    attributes: ["id"],
    where: { slug: "nouveautes" },
  });
  const nouveautesProducts = nouveautesCollection
    ? await Product.findAll({
        attributes: ["id", "title", "price_cents", "created_at"],
        include: [
          {
            model: Collection,
            as: "collections",
            attributes: [],
            through: { attributes: [] },
            where: { id: nouveautesCollection.id },
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
      })
    : [];
  const nouveautesItems = nouveautesProducts.map((product) => {
    const productJson = product.toJSON() as {
      id: number;
      title: string;
      price_cents: number;
      images?: Array<{ url: string; position: number | null }>;
    };
    const images = productJson.images ?? [];
    const firstImage = images
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
    return {
      id: Number(productJson.id),
      title: productJson.title,
      priceCents: productJson.price_cents,
      imageUrl: firstImage?.url ?? null,
    };
  });

  return (
    <div
      className={`storefront ${futura.className} min-h-screen bg-neutral-50 text-neutral-900`}
    >
      <StoreHeaderServer
        transparent
        fontClassName={futura.className}
        logoVariant="transparent"
      />
      <main>
        <section className="relative min-h-svh sm:min-h-[70vh]">
          <video
            src="https://lsdxrkxtirsssoebrdfh.supabase.co/storage/v1/object/public/Ecom/settings/out.mp4"
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          />
          <div className="absolute inset-0 bg-black/35" />
          <div className="relative z-10 flex min-h-svh items-end px-4 pb-10 pt-16 sm:min-h-[70vh] sm:px-6">
            <div className="w-full max-w-xl flex justify-center">
              <div className="flex w-full flex-col items-center gap-3">
                <button
                  type="button"
                  className="w-[90%] border border-white/80 bg-transparent px-6 py-3 text-base font-normal uppercase text-white shadow-sm transition hover:bg-white/10"
                >
                  Voir nos collections
                </button>
              </div>
            </div>
          </div>
        </section>
        <section id="section-2" className="bg-neutral-50 py-4">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-0 sm:px-6">
            <h2 className="text-center text-[24px] text-black lg:text-[32px]">
              Collections
            </h2>
            <div className="ml-3 no-scrollbar -mr-4 flex w-full flex-nowrap gap-4 overflow-x-auto pb-2 sm:-mr-6 sm:gap-6 snap-x snap-mandatory scroll-smooth touch-pan-x">
              {collections.map((collection) => (
                <CollectionCard
                  key={collection.id.toString()}
                  name={collection.title}
                  imageUrl={collection.image_url}
                />
              ))}
            </div>
          </div>
        </section>
        <section id="section-4" className="bg-[#f1eee9] py-0">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-0 sm:px-6">
            <div className="flex flex-col gap-6 bg-[#f1eee9] p-0 md:flex-row-reverse md:items-center md:gap-10 md:p-10">
              <div className="flex justify-center md:w-[55%]">
                <img
                  src="https://lsdxrkxtirsssoebrdfh.supabase.co/storage/v1/object/public/Ecom/settings/final_moment.png"
                  alt="Final moment"
                  className="w-full object-cover"
                />
              </div>
              <div className="space-y-4 px-6 pb-6 md:w-[45%]">
                <p className="text-xs uppercase text-black">Instant icon</p>
                <h3 className="text-[24px] font-medium text-black lg:text-[32px]">
                  A final moment on screen
                </h3>
                <p className="text-base text-[#767676]">
                  Jana Nayagan marque la fin d&apos;un chapitre cinematographique
                  unique.
                </p>
                <p className="text-base text-[#767676]">
                  Un dernier regard, une derniere emotion, capturee a travers des
                  pieces pensees pour durer bien au-dela du film.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section id="section-5" className="bg-white py-6">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-0 sm:px-6">
            <h2 className="text-center text-[24px] text-black lg:text-[32px]">
              Nouveautés
            </h2>
            <div className="no-scrollbar flex gap-0 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
              {nouveautesItems.length === 0 ? (
                <div className="text-sm text-[#767676]">
                  Aucun produit pour cette collection.
                </div>
              ) : (
                nouveautesItems.map((product) => (
                  <ProductCard
                    key={product.id}
                    name={product.title}
                    price={formatPrice(product.priceCents)}
                    imageUrl={product.imageUrl}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
