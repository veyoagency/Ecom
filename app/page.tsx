import localFont from "next/font/local";

import CollectionCard from "@/components/storefront/CollectionCard";
import ProductCard from "@/components/storefront/ProductCard";
import StoreHeader from "@/components/storefront/StoreHeader";

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

export default function Home() {
  return (
    <div
      className={`storefront ${futura.className} min-h-screen bg-neutral-50 text-neutral-900`}
    >
      <StoreHeader transparent fontClassName={futura.className} />
      <main>
        <section className="relative min-h-svh sm:min-h-[70vh]">
          <img
            src="/placeholder.svg"
            alt="Featured collection"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/35" />
          <div className="relative z-10 flex min-h-svh items-end px-4 pb-10 pt-16 sm:min-h-[70vh] sm:items-center sm:px-6">
            <div className="w-full max-w-xl flex justify-center">
              <div className="flex w-full flex-col items-center gap-3">
                <button
                  type="button"
                  className="w-[90%] border border-white/80 bg-transparent px-6 py-3 text-base font-normal uppercase text-white shadow-sm transition hover:bg-white/10"
                >
                  Homme
                </button>
                <button
                  type="button"
                  className="w-[90%] border border-white/80 bg-transparent px-6 py-3 text-base font-normal uppercase text-white shadow-sm transition hover:bg-white/10"
                >
                  Femme
                </button>
              </div>
            </div>
          </div>
        </section>
        <section id="section-1" className="bg-white py-10">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 sm:px-6">
            <h2 className="text-center text-[24px] text-black lg:text-[32px]">
              Nos marques
            </h2>
            <div className="flex gap-6 overflow-x-auto pb-2">
              {[
                "Maison Atelier",
                "Couture Studio",
                "Atelier Noir",
                "Studio Lune",
                "Maison Verre",
                "Editions Nord",
              ].map((name) => (
                <div
                  key={name}
                  className="flex min-w-[140px] items-center justify-center px-4 py-3 text-base font-normal uppercase text-neutral-600"
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
        </section>
        <section id="section-2" className="bg-neutral-50 py-12">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 sm:px-6">
            <h2 className="text-center text-[24px] text-black lg:text-[32px]">
              Nouveautés
            </h2>
            <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
              {[
                { name: "Blazer Oslo", price: "120,00€" },
                { name: "Chemise Atelier", price: "85,00€" },
                { name: "Jupe Lune", price: "75,00€" },
                { name: "Sac Noir", price: "140,00€" },
              ].map((product) => (
                <ProductCard
                  key={product.name}
                  name={product.name}
                  price={product.price}
                />
              ))}
            </div>
          </div>
        </section>
        <section id="section-2b" className="bg-white py-12">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 sm:px-6">
            <h2 className="text-center text-[24px] text-black lg:text-[32px]">
              Explorez une sélection de créations de la Maison
            </h2>
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {[
                "Hiver urbain",
                "Ligne atelier",
                "Nuances sable",
                "Noir absolu",
                "Studio denim",
                "Luxe minimal",
                "Ligne soiree",
                "Textures brutes"
              ].map((name) => (
                <CollectionCard key={name} name={name} />
              ))}
            </div>
          </div>
        </section>
        <section id="section-3" className="bg-white py-12">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 sm:px-6">
            <h2 className="text-center text-[24px] text-black lg:text-[32px]">
              Meilleurs ventes
            </h2>
            <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
              {[
                { name: "Manteau Atelier", price: "190,00€" },
                { name: "Pull Bergen", price: "95,00€" },
                { name: "Robe Luna", price: "130,00€" },
                { name: "Ceinture Studio", price: "55,00€" },
              ].map((product) => (
                <ProductCard
                  key={product.name}
                  name={product.name}
                  price={product.price}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
