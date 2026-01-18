import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk } from "next/font/google";

import { WebsiteSetting } from "@/lib/models";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-grotesk",
});

export async function generateMetadata(): Promise<Metadata> {
  let storeName = "New Commerce";
  try {
    const settings = await WebsiteSetting.findOne();
    const name = settings?.store_name?.trim();
    if (name) {
      storeName = name;
    }
  } catch {
    // Ignore metadata fetch errors and keep fallback store name.
  }

  return {
    title: {
      template: `%s • ${storeName} Back office`,
      default: `${storeName} Back office`,
    },
  };
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${grotesk.variable} min-h-screen bg-neutral-100 font-[var(--font-grotesk)] text-neutral-900`}
    >
      {children}
    </div>
  );
}
