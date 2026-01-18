import { headers } from "next/headers";
import { redirect } from "next/navigation";

import RegisterForm from "@/app/admin/register/RegisterForm";
import { Logo } from "@/components/ui/logo";
import { auth } from "@/lib/auth";
import { hasAdminAllowlist } from "@/lib/admin-config";
import { hasAdminUser } from "@/lib/admin-users";

export const metadata = {
  title: "Register",
};

export default async function AdminRegisterPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (session) {
    redirect("/admin");
  }

  const adminExists = await hasAdminUser();
  if (adminExists) {
    redirect("/admin/login");
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <RegisterForm />
            {hasAdminAllowlist() ? (
              <p className="text-muted-foreground mt-6 text-xs text-center">
                Only emails listed in ADMIN_EMAILS are allowed.
              </p>
            ) : null}
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
