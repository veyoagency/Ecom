import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-config";

function getEmailFromPayload(payload: Record<string, unknown>) {
  const user = payload.user as { email?: string } | undefined;
  if (user?.email) {
    return user.email.toLowerCase();
  }

  const email = payload.email as string | undefined;
  return email ? email.toLowerCase() : null;
}

export async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (match) {
    try {
      const token = match[1].trim();
      if (!token) {
        return {
          error: NextResponse.json(
            { error: "Non authentifie." },
            { status: 401 },
          ),
        };
      }

      const { payload } = await auth.api.verifyJWT({
        body: {
          token,
        },
      });

      if (!payload) {
        return {
          error: NextResponse.json({ error: "Non authentifie." }, { status: 401 }),
        };
      }

      const email = getEmailFromPayload(payload as Record<string, unknown>);
      if (!isAdminEmail(email)) {
        return {
          error: NextResponse.json({ error: "Acces refuse." }, { status: 403 }),
        };
      }

      return { email };
    } catch {
      return {
        error: NextResponse.json({ error: "Non authentifie." }, { status: 401 }),
      };
    }
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return {
      error: NextResponse.json({ error: "Non authentifie." }, { status: 401 }),
    };
  }

  const email = session.user.email?.toLowerCase() ?? null;
  if (!isAdminEmail(email)) {
    return {
      error: NextResponse.json({ error: "Acces refuse." }, { status: 403 }),
    };
  }

  return { email, session };
}
