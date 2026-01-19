"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  LayoutGrid,
  Package,
  Settings,
  ShoppingBag,
  Tag,
} from "lucide-react";

import AdminSignOutButton from "@/app/admin/components/AdminSignOutButton";
import { Logo } from "@/components/ui/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type NavSubItem = {
  key: "collections";
  label: string;
  href: string;
};

type NavItem = {
  key:
    | "dashboard"
    | "orders"
    | "products"
    | "discounts"
    | "analytics"
    | "settings";
  label: string;
  href: string;
  icon: typeof LayoutGrid;
  subItems?: NavSubItem[];
};

type AdminShellProps = {
  title: string;
  titleNode?: ReactNode;
  current:
    | "dashboard"
    | "orders"
    | "products"
    | "collections"
    | "discounts"
    | "analytics"
    | "settings";
  action?: ReactNode;
  children: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/admin",
    icon: LayoutGrid,
  },
  {
    key: "orders",
    label: "Orders",
    href: "/admin/orders",
    icon: ShoppingBag,
  },
  {
    key: "products",
    label: "Products",
    href: "/admin/products",
    icon: Package,
    subItems: [
      {
        key: "collections",
        label: "Collections",
        href: "/admin/collections",
      },
    ],
  },
  {
    key: "discounts",
    label: "Discounts",
    href: "/admin/discounts",
    icon: Tag,
  },
  {
    key: "analytics",
    label: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
  },
  {
    key: "settings",
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default function AdminShell({
  title,
  titleNode,
  current,
  action,
  children,
}: AdminShellProps) {
  const [storeName, setStoreName] = useState("New Commerce");

  useEffect(() => {
    let isActive = true;
    async function loadSettings() {
      try {
        const response = await fetch("/api/admin/settings");
        if (!response.ok) return;
        const data = await response.json().catch(() => null);
        const name = data?.settings?.store_name?.toString().trim();
        if (name && isActive) {
          setStoreName(name);
        }
      } catch {
        // Ignore settings fetch errors and keep fallback store name.
      }
    }
    loadSettings();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    document.title = `${title} • ${storeName} Back office`;
  }, [title, storeName]);

  return (
    <SidebarProvider defaultOpen>
      <Sidebar
        collapsible="icon"
        className="border-neutral-200 bg-white text-neutral-900"
      >
        <SidebarHeader className="gap-3 px-3 py-4">
          <Logo
            className="flex items-center gap-3"
            iconClassName="size-10 rounded-xl bg-neutral-900 text-white"
            labelClassName="text-sm font-semibold text-neutral-900 group-data-[collapsible=icon]:hidden"
            subtitle="Back office"
            subtitleClassName="text-xs text-neutral-500 group-data-[collapsible=icon]:hidden"
          />
        </SidebarHeader>
        <SidebarContent className="px-2">
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">
              Menu
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
                  const isParentActive =
                    current === item.key ||
                    item.subItems?.some((subItem) => subItem.key === current);
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        asChild
                        isActive={isParentActive}
                        tooltip={item.label}
                        className="text-neutral-600 hover:text-neutral-900 data-[active=true]:bg-neutral-900 data-[active=true]:text-white"
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.subItems ? (
                        <SidebarMenuSub>
                          {item.subItems.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.key}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={current === subItem.key}
                              >
                                <Link href={subItem.href}>
                                  <span>{subItem.label}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-2">
          <AdminSignOutButton />
        </SidebarFooter>
      </Sidebar>
      <SidebarRail />
      <SidebarInset className="bg-neutral-100">
        <main className="flex-1 px-6 py-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm" />
              {titleNode ? (
                <div className="flex flex-wrap items-start gap-2">{titleNode}</div>
              ) : (
                <h1 className="text-2xl font-semibold text-neutral-900">
                  {title}
                </h1>
              )}
            </div>
            {action ? <div className="flex items-center">{action}</div> : null}
          </div>
          <div className="grid gap-6">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
