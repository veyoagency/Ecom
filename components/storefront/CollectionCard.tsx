"use client";

type CollectionCardProps = {
  name: string;
  imageUrl?: string | null;
};

export default function CollectionCard({
  name,
  imageUrl = null,
}: CollectionCardProps) {
  return (
    <div className="flex min-w-[220px] flex-col gap-3 pb-2 snap-start sm:min-w-[260px] lg:min-w-[300px]">
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
}
