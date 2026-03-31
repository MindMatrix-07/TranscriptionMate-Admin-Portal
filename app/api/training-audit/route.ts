import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin-auth";
import {
  compareLyricsAgainstWebEvidence,
  summarizeTrainingAuditMatches,
} from "@/lib/training-audit-line-matcher";
import type { TrainingAuditResult } from "@/lib/training-audit";
import { collectTrainingAuditWebEvidence } from "@/lib/trainer-search";
import {
  listProviderSettings,
  listSiteProfiles,
} from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxInputLength = 12000;

export async function POST(request: Request) {
  const unauthorizedResponse = requireAdminApiAuth(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const body = (await request.json()) as { text?: string };
    const text = body.text?.trim() ?? "";

    if (!text) {
      return NextResponse.json(
        { error: "Lyrics text is required." },
        { status: 400 },
      );
    }

    if (text.length > maxInputLength) {
      return NextResponse.json(
        {
          error: `Keep the training audit input under ${maxInputLength} characters.`,
        },
        { status: 400 },
      );
    }

    const [providerSettings, siteProfiles] = await Promise.all([
      listProviderSettings(),
      listSiteProfiles(),
    ]);
    const webSearch = await collectTrainingAuditWebEvidence(
      text,
      providerSettings,
      siteProfiles,
    );
    const candidateMatches = await compareLyricsAgainstWebEvidence(
      text,
      webSearch.evidence,
      siteProfiles,
    );
    const summary = summarizeTrainingAuditMatches(candidateMatches);

    const audit = {
      candidateMatches,
      notes: [summary.summary, webSearch.notes].filter(Boolean).join(" "),
      providerChain: webSearch.providerChain,
      providerId: webSearch.providerId,
      queries: webSearch.queries,
      summary: summary.summary,
      topCandidate: summary.topCandidate,
      webEvidence: webSearch.evidence,
    } satisfies TrainingAuditResult;

    return NextResponse.json({ audit });
  } catch {
    return NextResponse.json(
      { error: "Training audit failed." },
      { status: 500 },
    );
  }
}
