"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const DEFAULT_ERROR = "Unable to create account.";

export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError("");

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const registerResponse = await fetch("/api/admin/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!registerResponse.ok) {
        const data = await registerResponse.json().catch(() => null);
        setError(data?.error || DEFAULT_ERROR);
        setLoading(false);
        return;
      }

      const loginResponse = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!loginResponse.ok) {
        const data = await loginResponse.json().catch(() => null);
        setError(data?.error || "Account created, sign in failed.");
        setLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError(DEFAULT_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Create admin account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Set the first admin credentials for the back office.
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="admin-register-email">Email</FieldLabel>
          <Input
            id="admin-register-email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-register-password">Password</FieldLabel>
          <Input
            id="admin-register-password"
            type="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </Button>
      </FieldGroup>
    </form>
  );
}
