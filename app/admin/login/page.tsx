import { headers } from "next/headers";
import { redirect } from "next/navigation";

import LoginForm from "@/app/admin/login/LoginForm";
import { Logo } from "@/components/ui/logo";
import { auth } from "@/lib/auth";
import { hasAdminAllowlist } from "@/lib/admin-config";
import { hasAdminUser } from "@/lib/admin-users";

export const metadata = {
  title: "Login",
};

export default async function AdminLoginPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (session) {
    redirect("/admin");
  }

  const adminExists = await hasAdminUser();
  if (!adminExists) {
    redirect("/admin/register");
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src="/placeholder.svg"
          alt="Back office preview"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </div>
  );
}
