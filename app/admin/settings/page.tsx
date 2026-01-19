import { headers } from "next/headers";
import { redirect } from "next/navigation";

import SettingsClient from "@/app/admin/settings/SettingsClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-config";
import { WebsiteSetting } from "@/lib/models";

export const metadata = {
  title: "Settings",
};

export default async function AdminSettingsPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    redirect("/admin/login");
  }

  const email = session.user.email?.toLowerCase();
  if (!isAdminEmail(email)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-6">
        <Card className="w-full max-w-md border-neutral-200 bg-white">
          <CardHeader className="text-center">
            <CardDescription className="text-xs uppercase tracking-[0.3em] text-neutral-400">
              Access denied
            </CardDescription>
            <CardTitle className="text-2xl">Admin not allowed</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-neutral-500">
            Your account is not in the allowed admin email list.
          </CardContent>
        </Card>
      </div>
    );
  }

  const settings = await WebsiteSetting.findOne();

  return (
    <SettingsClient
      settings={{
        storeName: settings?.store_name ?? "",
        domain: settings?.domain ?? "",
        websiteTitle: settings?.website_title ?? "",
        websiteDescription: settings?.website_description ?? "",
        defaultCurrency: settings?.default_currency ?? "EUR",
        logoUrl: settings?.logo_url ?? "",
        logoTransparentUrl: settings?.logo_transparent_url ?? "",
        brevoApiKeyHint: settings?.brevo_api_key_hint ?? null,
        stripePublishableKeyHint: settings?.stripe_publishable_key_hint ?? null,
        stripeSecretKeyHint: settings?.stripe_secret_key_hint ?? null,
        paypalClientIdHint: settings?.paypal_client_id_hint ?? null,
        paypalClientSecretHint: settings?.paypal_client_secret_hint ?? null,
        sendcloudPublicKeyHint: settings?.sendcloud_public_key_hint ?? null,
        sendcloudPrivateKeyHint: settings?.sendcloud_private_key_hint ?? null,
      }}
    />
  );
}
