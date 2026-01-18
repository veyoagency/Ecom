"use client";

type ProductCardProps = {
  name: string;
  price: string;
};

export default function ProductCard({ name, price }: ProductCardProps) {
  return (
    <div className="min-w-[220px] flex-1 sm:min-w-0">
      <div className="aspect-[4/5] w-full bg-neutral-200" />
      <div className="mt-4 text-base font-normal text-neutral-900">
        <div>{name}</div>
        <div className="mt-1 text-[#767676]">{price}</div>
      </div>
    </div>
  );
}
