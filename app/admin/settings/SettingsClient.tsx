"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import AdminShell from "@/app/admin/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SettingsData = {
  storeName: string;
  domain: string;
  websiteTitle: string;
  websiteDescription: string;
  defaultCurrency: string;
  logoUrl: string;
  logoTransparentUrl: string;
  brevoApiKey: string;
};

type SettingsClientProps = {
  settings: SettingsData;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

const MENU_ITEMS = ["General", "Emailing", "Shipping", "Users"] as const;
type MenuItem = (typeof MENU_ITEMS)[number];
const selectClassName =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default function SettingsClient({ settings }: SettingsClientProps) {
  const [activeMenu, setActiveMenu] = useState<MenuItem>("General");
  const [storeName, setStoreName] = useState(settings.storeName);
  const [domain, setDomain] = useState(settings.domain);
  const [websiteTitle, setWebsiteTitle] = useState(settings.websiteTitle);
  const [websiteDescription, setWebsiteDescription] = useState(
    settings.websiteDescription,
  );
  const [defaultCurrency, setDefaultCurrency] = useState(
    settings.defaultCurrency,
  );
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [logoTransparentUrl, setLogoTransparentUrl] = useState(
    settings.logoTransparentUrl,
  );
  const [logoUploading, setLogoUploading] = useState<"default" | "transparent" | null>(null);
  const [logoError, setLogoError] = useState("");
  const [logoTransparentError, setLogoTransparentError] = useState("");
  const [brevoApiKey, setBrevoApiKey] = useState(settings.brevoApiKey);
  const [settingsError, setSettingsError] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userFormError, setUserFormError] = useState("");
  const [userSaving, setUserSaving] = useState(false);

  const isValid = useMemo(
    () => Boolean(storeName.trim() && defaultCurrency.trim()),
    [storeName, defaultCurrency],
  );
  const isUserFormValid = useMemo(
    () => Boolean(userEmail.trim() && userPassword.trim()),
    [userEmail, userPassword],
  );

  async function handleSubmit() {
    if (!isValid || loading) return;
    setSettingsError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName,
          domain,
          websiteTitle,
          websiteDescription,
          defaultCurrency,
          brevoApiKey,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setSettingsError(data?.error || "Failed to save settings.");
        setLoading(false);
        return;
      }
    } catch {
      setSettingsError("Failed to save settings.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadLogo(file: File, variant: "default" | "transparent") {
    if (logoUploading) return;
    if (variant === "default") {
      setLogoError("");
    } else {
      setLogoTransparentError("");
    }
    setLogoUploading(variant);

    try {
      const formData = new FormData();
      formData.append("logo", file);
      formData.append("variant", variant);

      const response = await fetch("/api/admin/settings/logo", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error || "Failed to upload logo.";
        if (variant === "default") {
          setLogoError(message);
        } else {
          setLogoTransparentError(message);
        }
        setLogoUploading(null);
        return;
      }

      const nextUrl = data?.logoUrl?.toString();
      if (nextUrl) {
        if (variant === "default") {
          setLogoUrl(nextUrl);
        } else {
          setLogoTransparentUrl(nextUrl);
        }
      }
    } catch {
      if (variant === "default") {
        setLogoError("Failed to upload logo.");
      } else {
        setLogoTransparentError("Failed to upload logo.");
      }
    } finally {
      setLogoUploading(null);
    }
  }

  function handleLogoChange(
    event: ChangeEvent<HTMLInputElement>,
    variant: "default" | "transparent",
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadLogo(file, variant);
    event.target.value = "";
  }

  function handleLogoDrop(
    event: DragEvent<HTMLLabelElement>,
    variant: "default" | "transparent",
  ) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    uploadLogo(file, variant);
  }

  async function loadUsers() {
    if (usersLoading) return;
    setUsersLoading(true);
    setUsersError("");
    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setUsersError(data?.error || "Failed to load users.");
        setUsersLoading(false);
        return;
      }
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch {
      setUsersError("Failed to load users.");
    } finally {
      setUsersLoading(false);
    }
  }

  async function handleCreateUser() {
    if (!isUserFormValid || userSaving) return;
    setUserFormError("");
    setUserSaving(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userName,
          email: userEmail,
          password: userPassword,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setUserFormError(data?.error || "Failed to create user.");
        setUserSaving(false);
        return;
      }

      if (data?.user) {
        setUsers((prev) => [data.user, ...prev]);
      }
      setUserDialogOpen(false);
      setUserName("");
      setUserEmail("");
      setUserPassword("");
    } catch {
      setUserFormError("Failed to create user.");
    } finally {
      setUserSaving(false);
    }
  }

  useEffect(() => {
    if (activeMenu === "Users" && users.length === 0 && !usersLoading) {
      void loadUsers();
    }
    if (activeMenu !== "Users") {
      setUserDialogOpen(false);
    }
  }, [activeMenu, users.length, usersLoading]);

  const action =
    activeMenu === "Users" ? (
      <DialogTrigger asChild>
        <Button size="sm">Add user</Button>
      </DialogTrigger>
    ) : activeMenu === "General" || activeMenu === "Emailing" ? (
      <Button size="sm" onClick={handleSubmit} disabled={!isValid || loading}>
        {loading ? "Saving..." : "Save changes"}
      </Button>
    ) : null;

  return (
    <Dialog
      open={userDialogOpen}
      onOpenChange={(open) => {
        setUserDialogOpen(open);
        if (!open) {
          setUserFormError("");
          setUserName("");
          setUserEmail("");
          setUserPassword("");
        }
      }}
    >
      <AdminShell title="Settings" current="settings" action={action}>
        <Card className="border-neutral-200 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="border-neutral-200 px-6 py-6 md:w-56 md:border-r">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
                  Menu
                </p>
                <nav className="mt-4 flex flex-col gap-1">
                  {MENU_ITEMS.map((item) => {
                    const isActive = item === activeMenu;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setActiveMenu(item)}
                        className={`rounded-md px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "bg-neutral-900 text-white"
                            : "text-neutral-600 hover:bg-neutral-100"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </nav>
              </div>
              <div className="flex-1 px-6 py-6">
                {activeMenu === "General" ? (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900">
                        General
                      </h2>
                      <p className="text-sm text-neutral-500">
                        Update your store identity and public details.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <label
                          htmlFor="store-logo"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Logo
                        </label>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <label
                              htmlFor="store-logo"
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) =>
                                handleLogoDrop(event, "default")
                              }
                              className="flex min-h-[120px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500 transition hover:border-neutral-300"
                            >
                              {logoUrl ? (
                                <img
                                  src={logoUrl}
                                  alt="Store logo"
                                  className="max-h-24 w-auto object-contain"
                                />
                              ) : (
                                <div>
                                  <p className="font-medium text-neutral-700">
                                    Drag & drop your logo
                                  </p>
                                  <p className="text-xs text-neutral-400">
                                    or click to browse files
                                  </p>
                                </div>
                              )}
                              <input
                                id="store-logo"
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(event) =>
                                  handleLogoChange(event, "default")
                                }
                                disabled={logoUploading !== null}
                              />
                            </label>
                            {logoUploading === "default" ? (
                              <p className="text-xs text-neutral-500">
                                Uploading logo...
                              </p>
                            ) : null}
                            {logoError ? (
                              <p className="text-xs text-red-600">
                                {logoError}
                              </p>
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            <label
                              htmlFor="store-logo-transparent"
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) =>
                                handleLogoDrop(event, "transparent")
                              }
                              className="flex min-h-[120px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-500 transition hover:border-neutral-300"
                            >
                              {logoTransparentUrl ? (
                                <img
                                  src={logoTransparentUrl}
                                  alt="Transparent logo"
                                  className="max-h-24 w-auto object-contain"
                                />
                              ) : (
                                <div>
                                  <p className="font-medium text-neutral-700">
                                    Upload a transparent logo
                                  </p>
                                  <p className="text-xs text-neutral-400">
                                    or click to browse files
                                  </p>
                                </div>
                              )}
                              <input
                                id="store-logo-transparent"
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(event) =>
                                  handleLogoChange(event, "transparent")
                                }
                                disabled={logoUploading !== null}
                              />
                            </label>
                            {logoUploading === "transparent" ? (
                              <p className="text-xs text-neutral-500">
                                Uploading transparent logo...
                              </p>
                            ) : null}
                            {logoTransparentError ? (
                              <p className="text-xs text-red-600">
                                {logoTransparentError}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-xs text-neutral-500">
                          Recommended: transparent PNG or SVG, 400x200px.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="store-name"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Store name
                        </label>
                        <Input
                          id="store-name"
                          value={storeName}
                          onChange={(event) => setStoreName(event.target.value)}
                          placeholder="Atelier Commerce"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="domain"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Domain
                        </label>
                        <Input
                          id="domain"
                          value={domain}
                          onChange={(event) => setDomain(event.target.value)}
                          placeholder="ateliercommerce.fr"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="website-title"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Website title
                        </label>
                        <Input
                          id="website-title"
                          value={websiteTitle}
                          onChange={(event) =>
                            setWebsiteTitle(event.target.value)
                          }
                          placeholder="Atelier Commerce"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="default-currency"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Default currency
                        </label>
                        <select
                          id="default-currency"
                          value={defaultCurrency}
                          onChange={(event) =>
                            setDefaultCurrency(event.target.value)
                          }
                          className={selectClassName}
                        >
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                          <option value="GBP">GBP</option>
                        </select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label
                          htmlFor="website-description"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Website description
                        </label>
                        <textarea
                          id="website-description"
                          value={websiteDescription}
                          onChange={(event) =>
                            setWebsiteDescription(event.target.value)
                          }
                          placeholder="Describe your store."
                          className="border-input min-h-[96px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                        />
                      </div>
                    </div>

                    {settingsError ? (
                      <p className="text-sm text-red-600">{settingsError}</p>
                    ) : null}
                  </div>
                ) : activeMenu === "Users" ? (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900">
                        Users
                      </h2>
                      <p className="text-sm text-neutral-500">
                        Manage admin access for your team.
                      </p>
                    </div>

                    {usersError ? (
                      <p className="text-sm text-red-600">{usersError}</p>
                    ) : null}

                    <div className="overflow-hidden rounded-lg border border-neutral-200">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usersLoading ? (
                            <TableRow>
                              <TableCell
                                colSpan={3}
                                className="py-6 text-center text-sm text-neutral-500"
                              >
                                Loading users...
                              </TableCell>
                            </TableRow>
                          ) : users.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={3}
                                className="py-6 text-center text-sm text-neutral-500"
                              >
                                No admin users yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            users.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell className="font-medium text-neutral-900">
                                  {user.name || "Admin"}
                                </TableCell>
                                <TableCell className="text-neutral-600">
                                  {user.email}
                                </TableCell>
                                <TableCell className="text-neutral-500">
                                  {user.createdAt
                                    ? formatDateTime(user.createdAt)
                                    : "-"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : activeMenu === "Emailing" ? (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900">
                        Emailing
                      </h2>
                      <p className="text-sm text-neutral-500">
                        Configure the Brevo API key used to send order emails.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="brevo-api-key"
                        className="text-sm font-medium text-neutral-700"
                      >
                        Brevo secret key
                      </label>
                      <Input
                        id="brevo-api-key"
                        type="password"
                        value={brevoApiKey}
                        onChange={(event) => setBrevoApiKey(event.target.value)}
                        placeholder="xkeysib-..."
                      />
                      <p className="text-xs text-neutral-500">
                        This key is stored securely in the database and used for
                        all outgoing emails.
                      </p>
                    </div>

                    {settingsError ? (
                      <p className="text-sm text-red-600">{settingsError}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-neutral-900">
                      {activeMenu}
                    </h2>
                    <p className="text-sm text-neutral-500">
                      Settings for this section will be available soon.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </AdminShell>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add admin user</DialogTitle>
          <DialogDescription>
            Create a new login for the back office.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="user-name"
              className="text-sm font-medium text-neutral-700"
            >
              Name (optional)
            </label>
            <Input
              id="user-name"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              placeholder="Admin"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="user-email"
              className="text-sm font-medium text-neutral-700"
            >
              Email
            </label>
            <Input
              id="user-email"
              type="email"
              value={userEmail}
              onChange={(event) => setUserEmail(event.target.value)}
              placeholder="admin@ateliercommerce.fr"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="user-password"
              className="text-sm font-medium text-neutral-700"
            >
              Password
            </label>
            <Input
              id="user-password"
              type="password"
              value={userPassword}
              onChange={(event) => setUserPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>
          {userFormError ? (
            <p className="text-sm text-red-600">{userFormError}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUserDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateUser}
              disabled={!isUserFormValid || userSaving}
            >
              {userSaving ? "Saving..." : "Add user"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
