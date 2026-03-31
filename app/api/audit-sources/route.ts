import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin-auth";
import {
  supportedLyricLanguages,
  type LyricLanguage,
} from "@/lib/lyric-language";
import {
  deleteAuditSource,
  listAuditSources,
  upsertAuditSource,
} from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supportedLanguageSet = new Set<LyricLanguage>(supportedLyricLanguages);

export async function GET(request: Request) {
  const unauthorizedResponse = requireAdminApiAuth(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const sources = await listAuditSources();
  return NextResponse.json({ sources });
}

export async function POST(request: Request) {
  const unauthorizedResponse = requireAdminApiAuth(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const body = (await request.json()) as {
      domain?: string;
      enabled?: boolean;
      id?: string;
      language?: LyricLanguage;
      name?: string;
      notes?: string;
    };

    if (!body.name?.trim() || !body.domain?.trim()) {
      return NextResponse.json(
        { error: "Name and domain are required." },
        { status: 400 },
      );
    }

    if (!body.language || !supportedLanguageSet.has(body.language)) {
      return NextResponse.json(
        { error: "A supported lyric language is required." },
        { status: 400 },
      );
    }

    const source = await upsertAuditSource({
      domain: body.domain.trim(),
      enabled: body.enabled ?? true,
      id: body.id,
      language: body.language,
      name: body.name.trim(),
      notes: body.notes?.trim() ?? "",
      origin: "manual",
    });

    return NextResponse.json({ source });
  } catch {
    return NextResponse.json(
      { error: "Failed to save analysis source." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const unauthorizedResponse = requireAdminApiAuth(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const body = (await request.json()) as { id?: string };

    if (!body.id) {
      return NextResponse.json(
        { error: "Analysis source id is required." },
        { status: 400 },
      );
    }

    await deleteAuditSource(body.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete analysis source." },
      { status: 500 },
    );
  }
}
