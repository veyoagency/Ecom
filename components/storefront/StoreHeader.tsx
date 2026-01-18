"use client";

import Link from "next/link";
import { Menu, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function StoreHeader({
  transparent = false,
  fontClassName = "",
  logoUrl = null,
  storeName = "New Commerce",
}: {
  transparent?: boolean;
  fontClassName?: string;
  logoUrl?: string | null;
  storeName?: string;
}) {
  const iconClassName = transparent ? "text-white" : "text-neutral-900";
  const sheetClassName = `${fontClassName} bg-white`.trim();

  return (
    <header
      className={
        transparent
          ? "absolute inset-x-0 top-0 z-20 bg-transparent text-white"
          : "bg-white"
      }
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
        <div className="grid w-full grid-cols-3 items-center">
          <div className="flex h-full items-center justify-start">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open menu"
                  className="cursor-pointer hover:bg-transparent"
                >
                  <Menu className={`h-5 w-5 ${iconClassName}`} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className={sheetClassName}>
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                  <SheetDescription>
                    Browse the storefront sections.
                  </SheetDescription>
                </SheetHeader>
                <nav className="mt-4 flex flex-col gap-2 px-4">
                  <Link
                    href="/"
                    className="rounded-md px-3 py-2 text-base font-normal text-neutral-700 hover:bg-neutral-100"
                  >
                    Home
                  </Link>
                  <Link
                    href="/produits"
                    className="rounded-md px-3 py-2 text-base font-normal text-neutral-700 hover:bg-neutral-100"
                  >
                    Produits
                  </Link>
                  <Link
                    href="/panier"
                    className="rounded-md px-3 py-2 text-base font-normal text-neutral-700 hover:bg-neutral-100"
                  >
                    Panier
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex h-full items-center justify-center">
            <Link
              href="/"
              className={`text-base font-normal uppercase leading-none ${
                transparent ? "text-white" : "text-neutral-900"
              }`}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={storeName}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                storeName
              )}
            </Link>
          </div>
          <div className="flex h-full items-center justify-end">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open cart"
                  className="cursor-pointer hover:bg-transparent"
                >
                  <ShoppingBag className={`h-5 w-5 ${iconClassName}`} />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className={sheetClassName}>
                <SheetHeader>
                  <SheetTitle>Cart</SheetTitle>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4 px-4 pb-6">
                  <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
                    Your cart is empty.
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
