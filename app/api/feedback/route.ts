import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin-auth";
import { listFeedback } from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorizedResponse = requireAdminApiAuth(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const feedback = await listFeedback();
  return NextResponse.json({ feedback });
}
