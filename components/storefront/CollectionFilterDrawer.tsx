"use client";

import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type CollectionFilterDrawerProps = {
  count: number;
  maxPriceLabel?: string;
  availability: string[];
  onAvailabilityChange: (next: string[]) => void;
  priceMin: string;
  priceMax: string;
  onPriceMinChange: (value: string) => void;
  onPriceMaxChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
};

export default function CollectionFilterDrawer({
  count,
  maxPriceLabel = "€0",
  availability,
  onAvailabilityChange,
  priceMin,
  priceMax,
  onPriceMinChange,
  onPriceMaxChange,
  sort,
  onSortChange,
}: CollectionFilterDrawerProps) {
  const selectedAvailability = new Set(availability);

  function toggleAvailability(value: string) {
    const next = new Set(selectedAvailability);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onAvailabilityChange(Array.from(next));
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-0 text-sm font-normal text-neutral-900 hover:bg-transparent"
        >
          <Filter className="h-4 w-4" />
          Filtrer
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85%] bg-white px-0">
        <SheetHeader className="border-b border-neutral-200 px-6 pb-4 pt-6">
          <SheetTitle className="text-base font-normal text-neutral-900">
            Filtrer
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 px-6 py-4 text-sm text-neutral-800">
          <div className="space-y-3 border-b border-neutral-200 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-neutral-500">
                Disponibilite
              </span>
            </div>
            <label className="flex items-center gap-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={selectedAvailability.has("in_stock")}
                onChange={() => toggleAvailability("in_stock")}
                className="h-4 w-4 rounded border-neutral-300"
              />
              En stock
            </label>
            <label className="flex items-center gap-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={selectedAvailability.has("out_of_stock")}
                onChange={() => toggleAvailability("out_of_stock")}
                className="h-4 w-4 rounded border-neutral-300"
              />
              En rupture de stock
            </label>
          </div>
          <div className="space-y-3 border-b border-neutral-200 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-neutral-500">
                Prix
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 rounded-md border border-neutral-200 px-2 py-1.5">
                <span className="text-neutral-500">€</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={priceMin}
                  onChange={(event) => onPriceMinChange(event.target.value)}
                  className="h-8 border-0 px-0 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 rounded-md border border-neutral-200 px-2 py-1.5">
                <span className="text-neutral-500">€</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={priceMax}
                  onChange={(event) => onPriceMaxChange(event.target.value)}
                  className="h-8 border-0 px-0 text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-neutral-500">
              Le prix le plus eleve est de {maxPriceLabel}
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-neutral-500">
                Trier
              </span>
            </div>
            <select
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
              value={sort}
              onChange={(event) => onSortChange(event.target.value)}
            >
              <option value="best">Meilleures ventes</option>
              <option value="az">Alphabetique, de A a Z</option>
              <option value="za">Alphabetique, de Z a A</option>
              <option value="price_asc">Prix: faible a eleve</option>
              <option value="price_desc">Prix: eleve a faible</option>
            </select>
          </div>
        </div>
        <div className="border-t border-neutral-200 px-6 py-4">
          <SheetClose asChild>
            <Button className="w-full rounded-none bg-black text-white hover:bg-black/90">
              Voir {count} articles
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
