import localFont from "next/font/local";

import CollectionCard from "@/components/storefront/CollectionCard";
import StoreFooterServer from "@/components/storefront/StoreFooterServer";
import StoreHeaderServer from "@/components/storefront/StoreHeaderServer";
import { Collection } from "@/lib/models";

const futura = localFont({
  src: [
    {
      path: "../../public/fonts/FuturaPT-Book.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/FuturaPT-Book.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/FuturaPT-Book.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
});

export default async function CollectionsPage() {
  const collections = await Collection.findAll({
    attributes: ["id", "title", "image_url", "slug"],
    where: { listing_active: true },
    order: [["title", "ASC"]],
  });

  return (
    <div
      className={`storefront ${futura.className} min-h-screen bg-neutral-50 text-neutral-900`}
    >
      <StoreHeaderServer fontClassName={futura.className} />
      <main className="bg-white py-10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 sm:px-6">
          <h1 className="text-center text-[24px] text-black lg:text-[32px]">
            Collections
          </h1>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id.toString()}
                name={collection.title}
                imageUrl={collection.image_url}
                href={`/collections/${collection.slug}`}
                variant="grid"
              />
            ))}
          </div>
        </div>
      </main>
      <StoreFooterServer fontClassName={futura.className} />
    </div>
  );
}
