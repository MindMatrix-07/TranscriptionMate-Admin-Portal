import { NextResponse } from "next/server";
import {
  appendTrainingNote,
  listAuditRuns,
  listFeedback,
  listProviderSettings,
  listSiteProfiles,
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
            "You are the training assistant for a lyrics source-detection system. Help the admin refine site fingerprints, provider routing strategy, search patterns, and moderation logic. Be practical and concise. Suggest what to store as site notes, fingerprints, or provider settings when useful.",
        },
        {
          role: "user",
          content: JSON.stringify(promptPayload),
        },
      ],
      max_output_tokens: 500,
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
              text: "You are the training assistant for a lyrics source-detection system. Help the admin refine site fingerprints, provider routing strategy, search patterns, and moderation logic. Use Google Search grounding when it helps. Be practical and concise. Suggest what to store as site notes, fingerprints, or provider settings when useful.",
            },
          ],
        },
        tools: [
          {
            google_search: {},
          },
        ],
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

    const [siteProfiles, feedback, notes, providers, auditRuns] = await Promise.all([
      listSiteProfiles(),
      listFeedback(),
      listTrainingNotes(),
      listProviderSettings(),
      listAuditRuns(),
    ]);
    const promptPayload = {
      auditRuns: auditRuns.slice(0, 25),
      feedback: feedback.slice(0, 20),
      message,
      notes: notes.slice(-20),
      providers,
      siteProfiles: siteProfiles.slice(0, 30),
    };

    let reply =
      "Note saved. Configure GEMINI_API_KEY or OPENAI_API_KEY to enable live trainer chat replies. The saved admin note will still be used by the main-site audit prompt.";

    try {
      reply =
        (await requestGeminiReply(promptPayload)) ??
        (await requestOpenAiReply(promptPayload)) ??
        reply;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown trainer chat failure";
      reply = `Note saved, but the live trainer reply failed: ${message}`;
    }

    await appendTrainingNote({
      author: "assistant",
      content: reply,
    });

    const updatedNotes = await listTrainingNotes();

    return NextResponse.json({
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
