import Link from "next/link";
import localFont from "next/font/local";
import type { Metadata } from "next";

import { Heart, Lock, Tag } from "lucide-react";

import CollectionCard from "@/components/storefront/CollectionCard";
import ProductCard from "@/components/storefront/ProductCard";
import StoreFooterServer from "@/components/storefront/StoreFooterServer";
import StoreHeaderServer from "@/components/storefront/StoreHeaderServer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
    attributes: ["id", "title", "image_url", "slug"],
    where: { listing_active: true },
    order: [["title", "ASC"]],
  });
  const nouveautesCollection = await Collection.findOne({
    attributes: ["id"],
    where: { slug: "nouveautes" },
  });
  const nouveautesProducts = nouveautesCollection
    ? await Product.findAll({
        attributes: ["id", "title", "slug", "price_cents", "created_at"],
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
      slug: string;
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
      slug: productJson.slug,
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
                <Link
                  href="/collections"
                  className="w-[90%] border border-white/80 bg-transparent px-6 py-3 text-center text-base font-normal uppercase text-white shadow-sm transition hover:bg-white/10"
                >
                  Voir nos collections
                </Link>
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
                  href={`/collections/${collection.slug}`}
                  variant="slider"
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
                    href={`/produit/${product.slug}`}
                  />
                ))
              )}
            </div>
          </div>
        </section>
        <section id="section-6" className="bg-white py-6">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-8 px-4 sm:px-6">
            <div className="grid gap-8 sm:grid-cols-3">
              {[
                {
                  title: "Avantages exclusifs",
                  text:
                    "Bénéficiez de remises spéciales via nos partenaires et influenceurs.",
                  Icon: Tag,
                },
                {
                  title: "Conception soignée",
                  text:
                    "Un travail minutieux pour des vêtements confortables et durables.",
                  Icon: Heart,
                },
                {
                  title: "Paiement 100% sécurisé",
                  text:
                    "Transactions protégées et données confidentielles.",
                  Icon: Lock,
                },
              ].map(({ title, text, Icon }) => (
                <div key={title} className="flex flex-col items-center text-center">
                  <Icon className="h-6 w-6 text-neutral-900" />
                  <h3 className="mt-4 text-[24px] text-black lg:text-[28px]">
                    {title}
                  </h3>
                  <p className="mt-2 text-base text-[#767676]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section id="section-7" className="bg-white py-12">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 sm:px-6">
            <h2 className="text-center text-[24px] text-black lg:text-[32px]">
              Foire aux questions
            </h2>
            <Accordion type="single" collapsible className="border-t border-neutral-200">
              {[
                {
                  question: "Quels sont les délais de livraison ?",
                  answer:
                    "Les commandes sont préparées sous 48h.\nLa livraison en France prend ensuite en moyenne 2 à 4 jours ouvrés selon le transporteur.",
                },
                {
                  question: "Quelle est la politique de retour ?",
                  answer:
                    "Vous disposez de 14 jours après réception pour demander un retour, à condition que l’article soit non porté et dans son état d’origine.",
                },
                {
                  question: "Les vêtements sont-ils unisexes ?",
                  answer:
                    "Oui, nos coupes sont pensées pour s’adapter à toutes les silhouettes.",
                },
                {
                  question: "Comment choisir la bonne taille ?",
                  answer:
                    "Un guide des tailles est disponible sur chaque fiche produit.\nSi vous hésitez entre deux tailles, nous vous conseillons de prendre la taille au-dessus pour un rendu plus confortable.",
                },
                {
                  question: "Pourquoi cette collection est-elle spéciale ?",
                  answer:
                    "Jana Nayagan représente un moment historique : le dernier film de Vijay Thalapathy avant son entrée en politique.\nCette collection est un hommage à cet instant unique, pensé pour être porté et conservé comme un souvenir.",
                },
              ].map((item, index) => (
                <AccordionItem
                  key={item.question}
                  value={`faq-${index}`}
                  className="border-neutral-200"
                >
                  <AccordionTrigger className="text-sm font-normal text-black hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="whitespace-pre-line text-sm text-[#767676]">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
        <section id="section-8" className="bg-[#f1eee9] py-0">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-0 sm:px-6">
            <div className="flex flex-col gap-6 bg-[#f1eee9] p-0 md:flex-row-reverse md:items-center md:gap-10 md:p-10">
              <div className="flex justify-center md:w-[55%]">
                <img
                  src="https://lsdxrkxtirsssoebrdfh.supabase.co/storage/v1/object/public/Ecom/settings/clickncollect.webp"
                  alt="Click and collect"
                  className="w-full object-cover"
                />
              </div>
              <div className="space-y-4 px-6 pb-6 md:w-[45%]">
                <p className="text-xs uppercase text-black">Livraison</p>
                <h3 className="text-[24px] font-medium text-black lg:text-[32px]">
                  Click'n'Collect
                </h3>
                <p className="text-base text-[#767676]">
                  Profitez du retrait gratuit en récupérant votre commande lors de la première du film, directement sur le parking du Megarama de Villeneuve-la-Garenne.
                </p>
                <p className="text-base text-[#767676]">
                  Votre commande est préparée à l’avance afin de garantir un retrait rapide et sans attente.
                </p>
                <p className="text-sm text-[#767676]">
                  📍 Les informations précises (horaires et point de retrait) vous seront communiquées après la commande.
                </p>
              </div>
            </div>
          </div>
        </section>
        <StoreFooterServer fontClassName={futura.className} />
      </main>
    </div>
  );
}
