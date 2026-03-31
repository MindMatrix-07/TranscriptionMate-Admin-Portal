import {
  buildSearchQueryChunks,
  getSearchableLines,
} from "@/lib/training-audit";
import type { ProviderSetting, SiteProfile } from "@/lib/training-store";

export type TrainerWebEvidence = {
  providerId: string;
  score?: number | null;
  snippet: string;
  title: string;
  url: string;
};

export type TrainerSearchResult = {
  evidence: TrainerWebEvidence[];
  notes: string;
  providerChain: string[];
  providerId: string | null;
  queries: string[];
};

const defaultGeminiSearchModel =
  process.env.GEMINI_SEARCH_MODEL ?? "gemini-2.5-flash";
const geminiApiBaseUrl =
  "https://generativelanguage.googleapis.com/v1beta/models";
const tavilySearchUrl = "https://api.tavily.com/search";

function getMatchingDomains(message: string, siteProfiles: SiteProfile[]) {
  const lowered = message.toLowerCase();

  return siteProfiles
    .filter((profile) => {
      if (lowered.includes(profile.domain.toLowerCase())) {
        return true;
      }

      if (lowered.includes(profile.name.toLowerCase())) {
        return true;
      }

      return profile.fingerprints.some((fingerprint) =>
        lowered.includes(fingerprint.toLowerCase()),
      );
    })
    .map((profile) => profile.domain)
    .slice(0, 2);
}

function buildQueries(message: string, siteProfiles: SiteProfile[]) {
  const compactMessage = message.replace(/\s+/g, " ").trim().slice(0, 220);
  const domains = getMatchingDomains(message, siteProfiles);
  const queries = [compactMessage];

  for (const domain of domains) {
    queries.push(`site:${domain} ${compactMessage}`);
  }

  return [...new Set(queries)].filter(Boolean).slice(0, 3);
}

function buildLyricQueries(rawLyrics: string, siteProfiles: SiteProfile[]) {
  const lines = getSearchableLines(rawLyrics);
  const queryChunks = buildSearchQueryChunks(rawLyrics, {
    maxChunkChars: 110,
    maxChunks: 3,
  });
  const fingerprintQuery = queryChunks.map((chunk) => `"${chunk}"`).join(" ");
  const primaryLine = lines[0];
  const domains = getMatchingDomains(rawLyrics, siteProfiles).slice(0, 2);
  const queries: string[] = [];

  if (fingerprintQuery && domains[0]) {
    queries.push(`site:${domains[0]} ${fingerprintQuery}`);
  }

  if (fingerprintQuery && domains[1]) {
    queries.push(`site:${domains[1]} ${fingerprintQuery}`);
  }

  if (fingerprintQuery) {
    queries.push(`${fingerprintQuery} lyrics`);
  }

  if (primaryLine && domains[0]) {
    queries.push(`site:${domains[0]} "${primaryLine}"`);
  }

  if (primaryLine && domains[1]) {
    queries.push(`site:${domains[1]} "${primaryLine}"`);
  }

  if (primaryLine) {
    queries.push(`"${primaryLine}" lyrics`);
  }

  return [...new Set(queries)].filter(Boolean).slice(0, 6);
}

async function searchWithTavily(
  setting: ProviderSetting,
  queries: string[],
): Promise<TrainerSearchResult> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("Missing TAVILY_API_KEY");
  }

  const attemptedQueries: string[] = [];
  const evidence: TrainerWebEvidence[] = [];

  for (const query of queries) {
    attemptedQueries.push(query);

    const response = await fetch(tavilySearchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        exact_match: false,
        max_results: 5,
        query,
        search_depth: "basic",
        topic: "general",
      }),
      signal: AbortSignal.timeout(setting.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Tavily search failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      results?: Array<{
        content?: string;
        score?: number | null;
        title?: string;
        url?: string;
      }>;
    };
    const nextEvidence = (payload.results ?? [])
      .filter((result) => Boolean(result.content && result.title && result.url))
      .map((result) => ({
        providerId: setting.providerId,
        score: result.score ?? null,
        snippet: result.content ?? "",
        title: result.title ?? "Untitled result",
        url: result.url ?? "",
      }));

    evidence.push(...nextEvidence);

    if (nextEvidence.length > 0) {
      break;
    }
  }

  return {
    evidence: evidence.slice(0, 5),
    notes:
      evidence.length > 0
        ? `Tavily returned ${evidence.length} result${evidence.length === 1 ? "" : "s"} for the trainer prompt.`
        : "Tavily searched the web, but did not return matching evidence.",
    providerChain: evidence.length > 0 ? [setting.providerId] : [],
    providerId: evidence.length > 0 ? setting.providerId : null,
    queries: attemptedQueries,
  };
}

function extractGeminiText(candidate: {
  content?: {
    parts?: Array<{
      text?: string;
    }>;
  };
}) {
  return (
    candidate.content?.parts
      ?.map((part) => part.text?.trim())
      .filter((value): value is string => Boolean(value))
      .join("\n") ?? ""
  );
}

function buildGeminiEvidence(
  providerId: string,
  candidate: {
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: {
          title?: string;
          uri?: string;
        };
      }>;
      groundingSupports?: Array<{
        groundingChunkIndices?: number[];
        segment?: {
          text?: string;
        };
      }>;
      webSearchQueries?: string[];
    };
  },
) {
  const answerText = extractGeminiText(candidate);
  const chunks = candidate.groundingMetadata?.groundingChunks ?? [];
  const supports = candidate.groundingMetadata?.groundingSupports ?? [];
  const evidence: Array<TrainerWebEvidence | null> = chunks.map((chunk, index) => {
    const web = chunk.web;

    if (!web?.uri || !web.title) {
      return null;
    }

    const snippet =
      supports
        .filter((support) =>
          support.groundingChunkIndices?.includes(index),
        )
        .map((support) => support.segment?.text?.trim())
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .slice(0, 400) || answerText.slice(0, 400);

    return {
      providerId,
      score: null,
      snippet,
      title: web.title,
      url: web.uri,
    };
  });

  return evidence.filter((item): item is TrainerWebEvidence => item !== null);
}

async function searchWithGemini(
  setting: ProviderSetting,
  queries: string[],
): Promise<TrainerSearchResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const response = await fetch(
    `${geminiApiBaseUrl}/${defaultGeminiSearchModel}:generateContent?key=${apiKey}`,
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
                text: [
                  "Search the live web to help a lyrics moderation admin train a source-detection system.",
                  "Focus on sites, fingerprints, moderation guidance, and source clues related to this request.",
                  ...queries.map((query) => `- ${query}`),
                ].join("\n"),
              },
            ],
            role: "user",
          },
        ],
        generationConfig: {
          temperature: 0.1,
        },
        tools: [
          {
            google_search: {},
          },
        ],
      }),
      signal: AbortSignal.timeout(setting.timeoutMs),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini Search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
      groundingMetadata?: {
        groundingChunks?: Array<{
          web?: {
            title?: string;
            uri?: string;
          };
        }>;
        groundingSupports?: Array<{
          groundingChunkIndices?: number[];
          segment?: {
            text?: string;
          };
        }>;
        webSearchQueries?: string[];
      };
    }>;
  };
  const candidate = payload.candidates?.[0];

  if (!candidate) {
    return {
      evidence: [],
      notes: "Gemini Search returned no grounded candidate for the trainer prompt.",
      providerChain: [],
      providerId: null,
      queries,
    };
  }

  const evidence = buildGeminiEvidence(setting.providerId, candidate).slice(0, 5);

  return {
    evidence,
    notes:
      evidence.length > 0
        ? `Gemini Search grounded the trainer prompt against ${evidence.length} Google-backed result${evidence.length === 1 ? "" : "s"}.`
        : "Gemini Search ran for the trainer prompt, but it did not return grounded evidence.",
    providerChain: evidence.length > 0 ? [setting.providerId] : [],
    providerId: evidence.length > 0 ? setting.providerId : null,
    queries:
      candidate.groundingMetadata?.webSearchQueries?.filter(Boolean) ?? queries,
  };
}

async function collectEvidenceFromQueries(
  queries: string[],
  providerSettings: ProviderSetting[],
) {
  const enabledProviders = providerSettings
    .filter((provider) => provider.enabled)
    .sort((left, right) => left.priority - right.priority);
  const notes: string[] = [];
  const providerChain: string[] = [];

  for (const provider of enabledProviders) {
    providerChain.push(provider.providerId);

    try {
      if (provider.providerId === "tavily") {
        const result = await searchWithTavily(provider, queries);

        if (result.evidence.length > 0) {
          return {
            ...result,
            providerChain,
          };
        }

        notes.push(result.notes);
      } else if (provider.providerId === "gemini-search") {
        const result = await searchWithGemini(provider, queries);

        if (result.evidence.length > 0) {
          return {
            ...result,
            providerChain,
          };
        }

        notes.push(result.notes);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown provider failure";
      notes.push(`${provider.name} failed: ${message}.`);
    }
  }

  return {
    evidence: [] as TrainerWebEvidence[],
    notes:
      notes.join(" ") ||
      "No enabled trainer web-search provider returned usable evidence.",
    providerChain,
    providerId: null,
    queries,
  };
}

export async function collectTrainerWebEvidence(
  message: string,
  providerSettings: ProviderSetting[],
  siteProfiles: SiteProfile[],
) {
  const queries = buildQueries(message, siteProfiles);
  return collectEvidenceFromQueries(queries, providerSettings);
}

export async function collectTrainingAuditWebEvidence(
  rawLyrics: string,
  providerSettings: ProviderSetting[],
  siteProfiles: SiteProfile[],
) {
  const queries = buildLyricQueries(rawLyrics, siteProfiles);
  return collectEvidenceFromQueries(queries, providerSettings);
}
