"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Skull } from "lucide-react";

import { cn } from "@/lib/utils";

type LogoProps = {
  href?: string;
  label?: string;
  subtitle?: string;
  showLabel?: boolean;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  subtitleClassName?: string;
};

export function Logo({
  href = "/admin",
  label,
  subtitle,
  showLabel = true,
  className,
  iconClassName,
  labelClassName,
  subtitleClassName,
}: LogoProps) {
  const [resolvedLabel, setResolvedLabel] = useState(
    label ?? "New Commerce",
  );

  useEffect(() => {
    if (label) return;
    let isActive = true;
    async function loadSettings() {
      try {
        const response = await fetch("/api/admin/settings");
        if (!response.ok) return;
        const data = await response.json().catch(() => null);
        const storeName = data?.settings?.store_name?.toString().trim();
        if (storeName && isActive) {
          setResolvedLabel(storeName);
        }
      } catch {
        // Ignore settings fetch errors and keep fallback label.
      }
    }
    loadSettings();
    return () => {
      isActive = false;
    };
  }, [label]);

  const content = (
    <>
      <span
        className={cn(
          "bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md",
          iconClassName,
        )}
      >
        <Skull className="size-5" />
      </span>
      {showLabel ? (
        <span className={cn("flex flex-col leading-tight", labelClassName)}>
          <span className="font-medium">{resolvedLabel}</span>
          {subtitle ? (
            <span
              className={cn("text-xs text-muted-foreground", subtitleClassName)}
            >
              {subtitle}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );

  if (!href) {
    return <div className={cn("flex items-center gap-2", className)}>{content}</div>;
  }

  return (
    <Link href={href} className={cn("flex items-center gap-2", className)}>
      {content}
    </Link>
  );
}
