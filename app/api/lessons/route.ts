import { NextResponse } from "next/server";
import {
  deleteTrainingLesson,
  listTrainingLessons,
} from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const lessons = await listTrainingLessons();
  return NextResponse.json({ lessons });
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
