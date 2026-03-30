import { NextResponse } from "next/server";
import {
  appendTrainingNote,
  listFeedback,
  listSiteProfiles,
  listTrainingNotes,
} from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openAiApiUrl = "https://api.openai.com/v1/responses";
const defaultAuditModel = process.env.AUDIT_MODEL ?? "gpt-5-nano";

function extractOutputText(payload: unknown) {
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

    const [siteProfiles, feedback, notes] = await Promise.all([
      listSiteProfiles(),
      listFeedback(),
      listTrainingNotes(),
    ]);

    const apiKey = process.env.OPENAI_API_KEY;
    let reply =
      "Note saved. Configure OPENAI_API_KEY to enable live trainer chat replies. The saved admin note will still be used by the main-site audit prompt.";

    if (apiKey) {
      const response = await fetch(openAiApiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: defaultAuditModel,
          input: [
            {
              role: "system",
              content:
                "You are the training assistant for a lyrics source-detection system. Help the admin refine site fingerprints, search patterns, and moderation logic. Be practical and concise. Suggest what to store as site notes or fingerprints when useful.",
            },
            {
              role: "user",
              content: JSON.stringify({
                feedback: feedback.slice(0, 20),
                message,
                notes: notes.slice(-20),
                siteProfiles: siteProfiles.slice(0, 30),
              }),
            },
          ],
          max_output_tokens: 500,
        }),
      });

      if (response.ok) {
        const payload = (await response.json()) as unknown;
        reply = extractOutputText(payload) ?? reply;
      }
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
