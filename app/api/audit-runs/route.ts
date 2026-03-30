import { NextResponse } from "next/server";
import { listAuditRuns } from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auditRuns = await listAuditRuns();
  return NextResponse.json({ auditRuns: auditRuns.slice(0, 100) });
}
