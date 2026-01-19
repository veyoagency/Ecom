import localFont from "next/font/local";

import { CheckCircle2, MapPin } from "lucide-react";

import StorefrontCartProvider from "@/components/storefront/StorefrontCartProvider";
import StoreHeaderServer from "@/components/storefront/StoreHeaderServer";

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

export default function ThankYouPage() {
  return (
    <StorefrontCartProvider>
      <div className={`storefront ${futura.className} min-h-screen bg-neutral-100`}>
        <StoreHeaderServer />
        <main className="mx-auto w-full max-w-[1200px] px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              <div>
                <p className="text-xs uppercase text-neutral-500">
                  Confirmation #ABC123EXAMPLE
                </p>
                <h1 className="text-2xl text-neutral-900">
                  Merci, Garrett !
                </h1>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
              <div className="relative h-48 bg-neutral-200">
                <div className="absolute inset-0 bg-[linear-gradient(120deg,#d6e7e3,transparent_55%),linear-gradient(240deg,#cfe0de,transparent_55%)]" />
                <div className="absolute left-6 top-6 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600 shadow-sm">
                  <p className="text-[10px] uppercase text-neutral-400">
                    Shipping address
                  </p>
                  Washington DC
                </div>
                <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-red-500 shadow">
                  <MapPin className="h-4 w-4" />
                </div>
              </div>
              <div className="space-y-3 border-t border-neutral-200 bg-white px-6 py-5 text-sm">
                <p className="font-medium text-neutral-900">
                  Votre commande est confirmee
                </p>
                <p className="text-neutral-500">
                  Vous recevrez un email de confirmation avec votre numero de
                  commande.
                </p>
                <label className="flex items-center gap-2 text-xs text-neutral-500">
                  <input type="checkbox" />
                  Recevoir des nouveautes et offres.
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-medium text-neutral-900">
                Details de commande
              </h2>
              <div className="mt-4 grid gap-6 text-sm text-neutral-600 sm:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase text-neutral-400">
                      Contact
                    </p>
                    <p>garrett.reilly@example.com</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-neutral-400">
                      Adresse de livraison
                    </p>
                    <p>Garrett Reilly</p>
                    <p>1600 Pennsylvania Avenue NW</p>
                    <p>Washington DC 20500-0005</p>
                    <p>United States</p>
                    <p>+1 (202) 456-1414</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-neutral-400">
                      Mode d&apos;expedition
                    </p>
                    <p>Standard (Example)</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase text-neutral-400">
                      Mode de paiement
                    </p>
                    <p>Visa •••• 4242 - €29,98</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-neutral-400">
                      Adresse de facturation
                    </p>
                    <p>Garrett Reilly</p>
                    <p>1600 Pennsylvania Avenue NW</p>
                    <p>Washington DC 20500-0005</p>
                    <p>United States</p>
                    <p>+1 (202) 456-1414</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="relative h-14 w-14 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100" />
                <div className="flex-1 text-sm text-neutral-700">
                  <p>Pokemon Cute Pikachu Plush Dolls</p>
                  <p className="text-xs text-neutral-500">20CM / A</p>
                </div>
                <div className="text-sm text-neutral-700">59,98 €</div>
              </div>
              <div className="mt-6 space-y-2 border-t border-neutral-200 pt-4 text-sm text-neutral-600">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>59,98 €</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shipping</span>
                  <span>10,00 €</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Estimated taxes</span>
                  <span>10,00 €</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-base font-medium text-neutral-900">
                  <span>Total</span>
                  <span>USD $29,98</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
        </main>
      </div>
    </StorefrontCartProvider>
  );
}
