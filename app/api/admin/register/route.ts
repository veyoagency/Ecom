import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { hasAdminAllowlist, isAdminEmail } from "@/lib/admin-config";
import { hasAdminUser } from "@/lib/admin-users";

export const runtime = "nodejs";

function getStringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  if (await hasAdminUser()) {
    return NextResponse.json(
      { error: "Inscription admin desactivee." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  const email = getStringField((body as { email?: unknown }).email).toLowerCase();
  const password = getStringField((body as { password?: unknown }).password);

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email et mot de passe requis." },
      { status: 400 },
    );
  }

  if (hasAdminAllowlist() && !isAdminEmail(email)) {
    return NextResponse.json({ error: "Acces refuse." }, { status: 403 });
  }

  try {
    const result = await auth.api.signUpEmail({
      headers: request.headers,
      body: {
        name: "Admin",
        email,
        password,
      },
    });

    return NextResponse.json({ ok: true, user: result.user });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Inscription impossible.";

    return NextResponse.json(
      { error: message || "Inscription impossible." },
      { status: 400 },
    );
  }
}
