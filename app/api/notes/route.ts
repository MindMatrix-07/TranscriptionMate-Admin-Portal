import { NextResponse } from "next/server";
import { listTrainingNotes } from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const notes = await listTrainingNotes();
  return NextResponse.json({ notes });
}
