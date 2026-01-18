import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import {
  getAdminEmails,
  hasAdminAllowlist,
  isAdminEmail,
} from "@/lib/admin-config";
import { auth } from "@/lib/auth";
import { getPgPool } from "@/lib/postgres";

export const runtime = "nodejs";

function getStringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  const pool = getPgPool();

  if (hasAdminAllowlist()) {
    const allowedEmails = getAdminEmails();
    if (allowedEmails.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const result = await pool.query(
      'select id, name, email, "createdAt" from "user" where lower(email) = any($1) order by "createdAt" desc',
      [allowedEmails],
    );

    return NextResponse.json({ users: result.rows });
  }

  const result = await pool.query(
    'select id, name, email, "createdAt" from "user" order by "createdAt" desc',
  );

  return NextResponse.json({ users: result.rows });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) {
    return admin.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = getStringField((body as { name?: unknown }).name);
  const email = getStringField((body as { email?: unknown }).email).toLowerCase();
  const password = getStringField((body as { password?: unknown }).password);

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  if (hasAdminAllowlist() && !isAdminEmail(email)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  try {
    const result = await auth.api.signUpEmail({
      headers: request.headers,
      body: {
        name: name || "Admin",
        email,
        password,
      },
    });

    const createdAt =
      result.user?.createdAt instanceof Date
        ? result.user.createdAt.toISOString()
        : result.user?.createdAt;

    return NextResponse.json({
      user: {
        id: result.user?.id,
        name: result.user?.name,
        email: result.user?.email,
        createdAt,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create user.";

    return NextResponse.json(
      { error: message || "Failed to create user." },
      { status: 400 },
    );
  }
}
