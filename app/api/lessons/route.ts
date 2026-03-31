import { NextResponse } from "next/server";
import {
  appendTrainingLesson,
  deleteTrainingLesson,
  listTrainingLessons,
} from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const lessons = await listTrainingLessons();
  return NextResponse.json({ lessons });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      confidence?: "low" | "medium" | "high";
      evidenceSources?: string[];
      guidance?: string;
      providerHints?: string[];
      relatedDomains?: string[];
      sourceMessage?: string;
      title?: string;
    };

    if (!body.title?.trim() || !body.guidance?.trim() || !body.sourceMessage?.trim()) {
      return NextResponse.json(
        { error: "Title, guidance, and source message are required." },
        { status: 400 },
      );
    }

    const lesson = await appendTrainingLesson({
      confidence: body.confidence ?? "low",
      evidenceSources: body.evidenceSources ?? [],
      guidance: body.guidance.trim(),
      providerHints: body.providerHints ?? [],
      relatedDomains: body.relatedDomains ?? [],
      sourceMessage: body.sourceMessage.trim(),
      title: body.title.trim(),
    });

    return NextResponse.json({ lesson });
  } catch {
    return NextResponse.json(
      { error: "Failed to save training lesson." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };

    if (!body.id) {
      return NextResponse.json(
        { error: "Training lesson id is required." },
        { status: 400 },
      );
    }

    await deleteTrainingLesson(body.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete training lesson." },
      { status: 500 },
    );
  }
}
