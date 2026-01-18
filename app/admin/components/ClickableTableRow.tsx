"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ClickableTableRowProps = ComponentProps<typeof TableRow> & {
  href: string;
};

export default function ClickableTableRow({
  href,
  className,
  onClick,
  onKeyDown,
  ...props
}: ClickableTableRowProps) {
  const router = useRouter();

  return (
    <TableRow
      className={cn("cursor-pointer", className)}
      role="link"
      tabIndex={0}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          router.push(href);
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(href);
        }
      }}
      {...props}
    />
  );
}
