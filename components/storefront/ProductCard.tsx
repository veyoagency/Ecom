"use client";

import Link from "next/link";

type ProductCardProps = {
  name: string;
  price: string;
  imageUrl?: string | null;
  href?: string;
};

export default function ProductCard({
  name,
  price,
  imageUrl = null,
  href,
}: ProductCardProps) {
  const content = (
    <div className="min-w-[200px] flex-1 sm:min-w-0">
      <div className="aspect-[4/5] w-full bg-white">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="mt-4 pl-4 text-base font-normal text-neutral-900 sm:pl-0">
        <div>{name}</div>
        <div className="mt-1 text-[#767676]">{price}</div>
      </div>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}
