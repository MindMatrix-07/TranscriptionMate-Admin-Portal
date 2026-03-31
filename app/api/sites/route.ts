import { NextResponse } from "next/server";
import {
  deleteSiteProfile,
  listSiteProfiles,
  upsertSiteProfile,
} from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sites = await listSiteProfiles();
  return NextResponse.json({ sites });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      domain?: string;
      fingerprints?: string[];
      id?: string;
      name?: string;
      notes?: string;
      searchHint?: string;
    };

    if (!body.name || !body.domain) {
      return NextResponse.json(
        { error: "Name and domain are required." },
        { status: 400 },
      );
    }

    const site = await upsertSiteProfile({
      domain: body.domain.trim(),
      fingerprints: body.fingerprints ?? [],
      id: body.id,
      name: body.name.trim(),
      notes: body.notes?.trim() ?? "",
      searchHint: body.searchHint?.trim() ?? "",
    });

    return NextResponse.json({ site });
  } catch {
    return NextResponse.json(
      { error: "Failed to save site profile." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };

    if (!body.id) {
      return NextResponse.json(
        { error: "Site profile id is required." },
        { status: 400 },
      );
    }

    await deleteSiteProfile(body.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete site profile." },
      { status: 500 },
    );
  }
}
