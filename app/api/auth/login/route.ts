import { NextResponse } from "next/server";
import {
  buildAdminSessionCookie,
  isAdminPasswordConfigured,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isAdminPasswordConfigured()) {
      return NextResponse.json(
        { error: "ADMIN_PORTAL_PASSWORD is not configured." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as { password?: string };
    const password = body.password?.trim() ?? "";

    if (!password || !verifyAdminPassword(password)) {
      return NextResponse.json(
        { error: "Incorrect password." },
        { status: 401 },
      );
    }

    const cookie = buildAdminSessionCookie();

    if (!cookie) {
      return NextResponse.json(
        { error: "Could not create an admin session." },
        { status: 500 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookie);
    return response;
  } catch {
    return NextResponse.json(
      { error: "Login failed." },
      { status: 500 },
    );
  }
}
