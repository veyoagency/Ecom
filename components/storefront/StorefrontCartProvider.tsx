"use client";

import { CartProvider } from "@/components/storefront/cart-context";

export default function StorefrontCartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CartProvider>{children}</CartProvider>;
}
