import { NextResponse } from "next/server";
import { collectTrainerWebEvidence } from "@/lib/trainer-search";
import {
  appendTrainingLesson,
  appendTrainingNote,
  listAuditRuns,
  listFeedback,
  listProviderSettings,
  listSiteProfiles,
  listTrainingLessons,
  listTrainingNotes,
} from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const defaultOpenAiModel = process.env.AUDIT_MODEL ?? "gpt-5-nano";
const defaultGeminiModel =
  process.env.GEMINI_TRAINER_MODEL ??
  process.env.GEMINI_SEARCH_MODEL ??
  "gemini-2.5-flash";
const geminiApiBaseUrl =
  "https://generativelanguage.googleapis.com/v1beta/models";
const openAiApiUrl = "https://api.openai.com/v1/responses";

type TrainerMeta = {
  lessonCreated: boolean;
  liveAiEnabled: boolean;
  liveWebEnabled: boolean;
  modelUsed: "gemini" | "openai" | null;
  webEvidenceCount: number;
  webProviderUsed: string | null;
};

function getConfiguredWebProviders(
  providers: Awaited<ReturnType<typeof listProviderSettings>>,
) {
  return providers.filter((provider) => {
    if (!provider.enabled) {
      return false;
    }

    if (provider.providerId === "tavily") {
      return Boolean(process.env.TAVILY_API_KEY);
    }

    if (provider.providerId === "gemini-search") {
      return Boolean(process.env.GEMINI_API_KEY);
    }

    return false;
  });
}

function extractDomainsFromEvidence(
  evidence: Array<{ url: string }>,
  siteProfiles: Array<{ domain: string }>,
) {
  const domains = new Set<string>();

  for (const item of evidence) {
    try {
      domains.add(new URL(item.url).hostname.replace(/^www\./, ""));
    } catch {
      continue;
    }
  }

  for (const profile of siteProfiles) {
    if (domains.has(profile.domain)) {
      continue;
    }
  }

  return [...domains].slice(0, 5);
}

function buildLessonTitle(message: string, domains: string[]) {
  if (domains[0]) {
    return `Trainer lesson for ${domains[0]}`;
  }

  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length > 72 ? `${compact.slice(0, 69)}...` : compact;
}

function buildLessonConfidence(evidenceCount: number) {
  if (evidenceCount >= 3) {
    return "high" as const;
  }

  if (evidenceCount >= 1) {
    return "medium" as const;
  }

  return "low" as const;
}

function extractOpenAiText(payload: unknown) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("output" in payload) ||
    !Array.isArray(payload.output)
  ) {
    return null;
  }

  for (const item of payload.output) {
    if (
      item &&
      typeof item === "object" &&
      "type" in item &&
      item.type === "message" &&
      "content" in item &&
      Array.isArray(item.content)
    ) {
      for (const contentItem of item.content) {
        if (
          contentItem &&
          typeof contentItem === "object" &&
          "type" in contentItem &&
          contentItem.type === "output_text" &&
          "text" in contentItem &&
          typeof contentItem.text === "string"
        ) {
          return contentItem.text;
        }
      }
    }
  }

  return null;
}

function extractGeminiText(payload: unknown) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("candidates" in payload) ||
    !Array.isArray(payload.candidates)
  ) {
    return null;
  }

  const candidate = payload.candidates[0];

  if (
    !candidate ||
    typeof candidate !== "object" ||
    !("content" in candidate) ||
    !candidate.content ||
    typeof candidate.content !== "object" ||
    !("parts" in candidate.content) ||
    !Array.isArray(candidate.content.parts)
  ) {
    return null;
  }

  const parts = candidate.content.parts
    .map((part: unknown) =>
      part && typeof part === "object" && "text" in part && typeof part.text === "string"
        ? part.text.trim()
        : "",
    )
    .filter(Boolean);

  return parts.join("\n") || null;
}

async function requestOpenAiReply(promptPayload: object) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch(openAiApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: defaultOpenAiModel,
      input: [
        {
          role: "system",
          content:
            "You are the training assistant for a lyrics source-detection system. Help the admin refine site fingerprints, provider routing strategy, search patterns, and moderation logic. Use the fetched web evidence directly, cite concrete site clues when present, and be practical and concise. Suggest what to store as site notes, fingerprints, or provider settings when useful.",
        },
        {
          role: "user",
          content: JSON.stringify(promptPayload),
        },
      ],
      max_output_tokens: 700,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI trainer chat failed with status ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return extractOpenAiText(payload);
}

async function requestGeminiReply(promptPayload: object) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch(
    `${geminiApiBaseUrl}/${defaultGeminiModel}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: JSON.stringify(promptPayload),
              },
            ],
            role: "user",
          },
        ],
        systemInstruction: {
          parts: [
            {
              text: "You are the training assistant for a lyrics source-detection system. Help the admin refine site fingerprints, provider routing strategy, search patterns, and moderation logic. Use the fetched web evidence directly, cite concrete site clues when present, and be practical and concise. Suggest what to store as site notes, fingerprints, or provider settings when useful.",
            },
          ],
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini trainer chat failed with status ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return extractGeminiText(payload);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: string };
    const message = body.message?.trim() ?? "";

    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 },
      );
    }

    await appendTrainingNote({
      author: "admin",
      content: message,
    });

    const [siteProfiles, feedback, notes, providers, auditRuns, lessons] = await Promise.all([
      listSiteProfiles(),
      listFeedback(),
      listTrainingNotes(),
      listProviderSettings(),
      listAuditRuns(),
      listTrainingLessons(),
    ]);
    const liveAiEnabled = Boolean(
      process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
    );
    const configuredWebProviders = getConfiguredWebProviders(providers);
    const trainerWebSearch = await collectTrainerWebEvidence(
      message,
      providers,
      siteProfiles,
    );
    const liveWebEnabled = configuredWebProviders.length > 0;
    const promptPayload = {
      auditRuns: auditRuns.slice(0, 25),
      feedback: feedback.slice(0, 20),
      lessons: lessons.slice(0, 25),
      message,
      notes: notes.slice(-20),
      providers,
      siteProfiles: siteProfiles.slice(0, 30),
      trainerWebEvidence: trainerWebSearch.evidence,
      trainerWebNotes: trainerWebSearch.notes,
      trainerWebQueries: trainerWebSearch.queries,
    };
    const meta: TrainerMeta = {
      lessonCreated: false,
      liveAiEnabled,
      liveWebEnabled,
      modelUsed: null,
      webEvidenceCount: trainerWebSearch.evidence.length,
      webProviderUsed:
        trainerWebSearch.providerId ?? configuredWebProviders[0]?.providerId ?? null,
    };

    let reply =
      "Note saved, but live trainer mode needs both an AI key and at least one enabled web-search provider key.";

    if (liveAiEnabled && liveWebEnabled) {
      try {
        const geminiReply = await requestGeminiReply(promptPayload);

        if (geminiReply) {
          reply = geminiReply;
          meta.modelUsed = "gemini";
        } else {
          const openAiReply = await requestOpenAiReply(promptPayload);

          if (openAiReply) {
            reply = openAiReply;
            meta.modelUsed = "openai";
          }
        }
      } catch (error) {
        const failureMessage =
          error instanceof Error ? error.message : "Unknown trainer chat failure";
        reply = `Note saved, but the live trainer reply failed: ${failureMessage}`;
      }
    } else if (liveAiEnabled) {
      reply =
        "Note saved, but live trainer mode is waiting for an enabled web-search provider with a valid API key.";
    } else if (liveWebEnabled) {
      reply =
        "Note saved, but live trainer mode is waiting for an AI model key like GEMINI_API_KEY or OPENAI_API_KEY.";
    }

    await appendTrainingNote({
      author: "assistant",
      content: reply,
    });

    if (liveAiEnabled && liveWebEnabled && reply) {
      const relatedDomains = extractDomainsFromEvidence(
        trainerWebSearch.evidence,
        siteProfiles,
      );
      const lesson = await appendTrainingLesson({
        confidence: buildLessonConfidence(trainerWebSearch.evidence.length),
        evidenceSources: trainerWebSearch.evidence.map((item) => item.url).slice(0, 5),
        guidance: reply,
        providerHints: trainerWebSearch.providerId ? [trainerWebSearch.providerId] : [],
        relatedDomains,
        sourceMessage: message,
        title: buildLessonTitle(message, relatedDomains),
      });

      if (lesson.id) {
        meta.lessonCreated = true;
      }
    }

    const updatedNotes = await listTrainingNotes();
    const updatedLessons = await listTrainingLessons();

    return NextResponse.json({
      lessons: updatedLessons,
      meta,
      notes: updatedNotes,
      reply,
    });
  } catch {
    return NextResponse.json(
      { error: "Trainer chat failed." },
      { status: 500 },
    );
  }
}
