import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin-auth";
import {
  deleteTrainingNote,
  listTrainingNotes,
} from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorizedResponse = requireAdminApiAuth(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const notes = await listTrainingNotes();
  return NextResponse.json({ notes });
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
        { error: "Training note id is required." },
        { status: 400 },
      );
    }

    await deleteTrainingNote(body.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete training note." },
      { status: 500 },
    );
  }
}
