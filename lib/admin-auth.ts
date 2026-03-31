import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const adminSessionCookieName = "tm_admin_session";
const sessionTtlSeconds = 60 * 60 * 24 * 30;

function hashValue(value: string) {
  return createHash("sha256").update(`transcriptionmate-admin:${value}`).digest("hex");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookieHeader(header: string | null) {
  const cookiesMap = new Map<string, string>();

  if (!header) {
    return cookiesMap;
  }

  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    const name = rawName?.trim();

    if (!name) {
      continue;
    }

    cookiesMap.set(name, decodeURIComponent(rawValue.join("=").trim()));
  }

  return cookiesMap;
}

export function isAdminPasswordConfigured() {
  return Boolean(process.env.ADMIN_PORTAL_PASSWORD?.trim());
}

export function getAdminSessionValue() {
  const password = process.env.ADMIN_PORTAL_PASSWORD?.trim();

  if (!password) {
    return null;
  }

  return hashValue(password);
}

export function verifyAdminPassword(password: string) {
  const expected = getAdminSessionValue();

  if (!expected) {
    return false;
  }

  return safeCompare(hashValue(password.trim()), expected);
}

export function isAdminRequestAuthenticated(request: Request) {
  if (!isAdminPasswordConfigured()) {
    return true;
  }

  const expected = getAdminSessionValue();
  const sessionValue = parseCookieHeader(request.headers.get("cookie")).get(
    adminSessionCookieName,
  );

  if (!expected || !sessionValue) {
    return false;
  }

  return safeCompare(sessionValue, expected);
}

export async function isAdminPageAuthenticated() {
  if (!isAdminPasswordConfigured()) {
    return true;
  }

  const expected = getAdminSessionValue();
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(adminSessionCookieName)?.value;

  if (!expected || !sessionValue) {
    return false;
  }

  return safeCompare(sessionValue, expected);
}

export function buildAdminSessionCookie() {
  const value = getAdminSessionValue();

  if (!value) {
    return null;
  }

  return {
    httpOnly: true,
    maxAge: sessionTtlSeconds,
    name: adminSessionCookieName,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    value,
  };
}

export function clearAdminSessionCookie() {
  return {
    httpOnly: true,
    maxAge: 0,
    name: adminSessionCookieName,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    value: "",
  };
}

export function requireAdminApiAuth(request: Request) {
  if (isAdminRequestAuthenticated(request)) {
    return null;
  }

  return NextResponse.json(
    { error: "Unauthorized." },
    {
      status: 401,
    },
  );
}
