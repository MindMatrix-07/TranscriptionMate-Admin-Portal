import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin-auth";
import {
  listProviderSettings,
  upsertProviderSetting,
  type ProviderMode,
} from "@/lib/training-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supportedProviderIds = new Set(["gemini-search", "tavily"]);
const providerModes = new Set<ProviderMode>(["always", "low-confidence-only"]);

export async function GET(request: Request) {
  const unauthorizedResponse = requireAdminApiAuth(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const providers = await listProviderSettings();

  return NextResponse.json({
    providers,
    supportedProviders: [...supportedProviderIds],
  });
}

export async function POST(request: Request) {
  const unauthorizedResponse = requireAdminApiAuth(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const body = (await request.json()) as {
      allowFallback?: boolean;
      dailySoftLimit?: number;
      enabled?: boolean;
      id?: string;
      mode?: ProviderMode;
      name?: string;
      priority?: number;
      providerId?: string;
      timeoutMs?: number;
    };

    if (!body.providerId || !supportedProviderIds.has(body.providerId)) {
      return NextResponse.json(
        { error: "Unsupported provider." },
        { status: 400 },
      );
    }

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Provider name is required." },
        { status: 400 },
      );
    }

    if (!body.mode || !providerModes.has(body.mode)) {
      return NextResponse.json(
        { error: "Provider mode is invalid." },
        { status: 400 },
      );
    }

    const provider = await upsertProviderSetting({
      allowFallback: Boolean(body.allowFallback),
      dailySoftLimit: Math.max(0, Number(body.dailySoftLimit ?? 0)),
      enabled: Boolean(body.enabled),
      id: body.id,
      mode: body.mode,
      name: body.name.trim(),
      priority: Math.max(1, Number(body.priority ?? 1)),
      providerId: body.providerId,
      timeoutMs: Math.max(1000, Number(body.timeoutMs ?? 8000)),
    });

    return NextResponse.json({ provider });
  } catch {
    return NextResponse.json(
      { error: "Failed to save provider settings." },
      { status: 500 },
    );
  }
}
