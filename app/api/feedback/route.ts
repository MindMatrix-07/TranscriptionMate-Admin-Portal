import { NextResponse } from "next/server";
import { listFeedback } from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const feedback = await listFeedback();
  return NextResponse.json({ feedback });
}
