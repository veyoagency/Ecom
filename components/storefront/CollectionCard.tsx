"use client";

import Link from "next/link";

type CollectionCardProps = {
  name: string;
  imageUrl?: string | null;
  href?: string;
  variant?: "slider" | "grid";
};

export default function CollectionCard({
  name,
  imageUrl = null,
  href,
  variant = "slider",
}: CollectionCardProps) {
  const wrapperClass =
    variant === "slider"
      ? "flex min-w-[220px] flex-col gap-3 pb-2 snap-start sm:min-w-[260px] lg:min-w-[300px]"
      : "flex w-full flex-col gap-3";

  const content = (
    <div className={wrapperClass}>
      <div className="aspect-[4/5] w-full bg-neutral-200">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="text-center text-base font-normal text-neutral-900">
        {name}
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
