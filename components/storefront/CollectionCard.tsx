"use client";

type CollectionCardProps = {
  name: string;
};

export default function CollectionCard({ name }: CollectionCardProps) {
  return (
    <div className="flex flex-col gap-3 pb-2">
      <div className="aspect-[4/5] w-full bg-neutral-200" />
      <div className="text-center text-base font-normal capitalize text-neutral-900">
        {name}
      </div>
    </div>
  );
}
