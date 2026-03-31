"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { TrainingAuditResult } from "@/lib/training-audit";
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  Database,
  LoaderCircle,
  LogOut,
  MessageSquare,
  MoonStar,
  RefreshCw,
  Route,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SunMedium,
  Trash2,
} from "lucide-react";

type SiteProfile = {
  createdAt: string;
  domain: string;
  fingerprints: string[];
  id: string;
  name: string;
  notes: string;
  searchHint: string;
  updatedAt: string;
};

type TrainingNote = {
  author: "admin" | "assistant";
  content: string;
  createdAt: string;
  id: string;
};

type TrainingLesson = {
  confidence: "low" | "medium" | "high";
  createdAt: string;
  evidenceSources: string[];
  guidance: string;
  id: string;
  providerHints: string[];
  relatedDomains: string[];
  sourceMessage: string;
  title: string;
  updatedAt: string;
};

type AuditFeedback = {
  auditSummary: string;
  createdAt: string;
  id: string;
  inputExcerpt: string;
  likelySourceDomain: string | null;
  likelySourceName: string | null;
  providerId?: string | null;
  spamProbability: number;
  verdict: "yes" | "no";
};

type ProviderMode = "always" | "low-confidence-only";

type ProviderSetting = {
  allowFallback: boolean;
  createdAt: string;
  dailySoftLimit: number;
  enabled: boolean;
  id: string;
  mode: ProviderMode;
  name: string;
  priority: number;
  providerId: string;
  timeoutMs: number;
  updatedAt: string;
};

type AuditRun = {
  createdAt: string;
  fallbackChain: string[];
  id: string;
  inputHash: string;
  likelySourceDomain: string | null;
  likelySourceName: string | null;
  notes: string;
  providerId: string | null;
  queries: string[];
  searchResultCount: number;
  spamProbability: number;
  status: "success" | "fallback" | "heuristic" | "error";
  webEvidence: Array<{
    providerId: string;
    score?: number | null;
    snippet: string;
    title: string;
    url: string;
  }>;
};

type Theme = "light" | "dark";

type TrainerMeta = {
  lessonCreated: boolean;
  liveAiEnabled: boolean;
  liveWebEnabled: boolean;
  modelUsed: "gemini" | "openai" | null;
  webEvidenceCount: number;
  webProviderUsed: string | null;
};

type AdminPortalProps = {
  authEnabled?: boolean;
};

const emptySiteForm = {
  domain: "",
  fingerprints: "",
  name: "",
  notes: "",
  searchHint: "",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code class="rounded bg-black/20 px-1.5 py-0.5 text-[0.95em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}

function MarkdownContent({
  className = "",
  value,
}: {
  className?: string;
  value: string;
}) {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trimEnd() ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line.trim())) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ol key={`ol-${index}`} className="list-decimal space-y-2 pl-5">
          {items.map((item, itemIndex) => (
            <li
              key={`ol-item-${itemIndex}`}
              dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(item) }}
            />
          ))}
        </ol>,
      );
      continue;
    }

    if (/^[*-]\s+/.test(line.trim())) {
      const items: string[] = [];

      while (index < lines.length && /^[*-]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[*-]\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ul key={`ul-${index}`} className="list-disc space-y-2 pl-5">
          {items.map((item, itemIndex) => (
            <li
              key={`ul-item-${itemIndex}`}
              dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(item) }}
            />
          ))}
        </ul>,
      );
      continue;
    }

    const paragraphLines: string[] = [];

    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\d+\.\s+/.test(lines[index].trim()) &&
      !/^[*-]\s+/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(
      <p
        key={`p-${index}`}
        className="leading-7"
        dangerouslySetInnerHTML={{
          __html: paragraphLines.map((item) => formatInlineMarkdown(item)).join("<br />"),
        }}
      />,
    );
  }

  return <div className={`space-y-4 ${className}`}>{blocks}</div>;
}

function formatProviderName(value?: string | null) {
  if (!value) {
    return "No provider";
  }

  return value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getHostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function extractRelatedDomains(value: string) {
  return [...new Set(value.match(/\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b/gi) ?? [])].slice(
    0,
    5,
  );
}

function deriveSiteName(domain: string, title: string) {
  if (title && title.length <= 60) {
    return title;
  }

  const label = domain.replace(/^www\./, "").split(".")[0] ?? domain;
  return label
    .split(/[-_]/g)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildLessonSearchHint(lesson: TrainingLesson, domain: string) {
  const source = lesson.sourceMessage.replace(/\s+/g, " ").trim().slice(0, 72);
  return source ? `site:${domain} "${source}"` : `site:${domain} lyrics`;
}

function buildLessonTitleFromSource(sourceMessage: string, domains: string[]) {
  if (domains[0]) {
    return `Rule for ${domains[0]}`;
  }

  const compact = sourceMessage.replace(/\s+/g, " ").trim();

  if (!compact) {
    return "Trainer rule";
  }

  return compact.length > 72 ? `${compact.slice(0, 69)}...` : compact;
}

function deriveProfileName(domain: string, title: string) {
  if (
    title &&
    title.length <= 48 &&
    !/^rule for /i.test(title) &&
    !/^trainer lesson for /i.test(title)
  ) {
    return title;
  }

  return deriveSiteName(domain, "");
}

export function AdminPortal({ authEnabled = false }: AdminPortalProps) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const [sites, setSites] = useState<SiteProfile[]>([]);
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [notes, setNotes] = useState<TrainingNote[]>([]);
  const [feedback, setFeedback] = useState<AuditFeedback[]>([]);
  const [providers, setProviders] = useState<ProviderSetting[]>([]);
  const [auditRuns, setAuditRuns] = useState<AuditRun[]>([]);
  const [siteForm, setSiteForm] = useState(emptySiteForm);
  const [chatInput, setChatInput] = useState("");
  const [trainingAuditInput, setTrainingAuditInput] = useState("");
  const [trainingAudit, setTrainingAudit] = useState<TrainingAuditResult | null>(
    null,
  );
  const [trainingAuditError, setTrainingAuditError] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isRunningTrainingAudit, setIsRunningTrainingAudit] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [savingLessonRuleId, setSavingLessonRuleId] = useState<string | null>(null);
  const [applyingLessonId, setApplyingLessonId] = useState<string | null>(null);
  const [trainerMeta, setTrainerMeta] = useState<TrainerMeta | null>(null);
  const [savingProviderId, setSavingProviderId] = useState<string | null>(null);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("transcriptionmate-admin-theme", theme);
  }, [mounted, theme]);

  useEffect(() => {
    void refreshAll();
  }, []);

  async function refreshAll() {
    setIsLoading((current) => current || !isRefreshing);
    setIsRefreshing(true);

    try {
      const [
        sitesResponse,
        lessonsResponse,
        notesResponse,
        feedbackResponse,
        providersResponse,
        auditRunsResponse,
      ] = await Promise.all([
        fetch("/api/sites"),
        fetch("/api/lessons"),
        fetch("/api/notes"),
        fetch("/api/feedback"),
        fetch("/api/providers"),
        fetch("/api/audit-runs"),
      ]);

      const sitesPayload = (await sitesResponse.json()) as { sites: SiteProfile[] };
      const lessonsPayload = (await lessonsResponse.json()) as {
        lessons: TrainingLesson[];
      };
      const notesPayload = (await notesResponse.json()) as { notes: TrainingNote[] };
      const feedbackPayload = (await feedbackResponse.json()) as {
        feedback: AuditFeedback[];
      };
      const providersPayload = (await providersResponse.json()) as {
        providers: ProviderSetting[];
      };
      const auditRunsPayload = (await auditRunsResponse.json()) as {
        auditRuns: AuditRun[];
      };

      setSites(sitesPayload.sites ?? []);
      setLessons(lessonsPayload.lessons ?? []);
      setNotes(notesPayload.notes ?? []);
      setFeedback(feedbackPayload.feedback ?? []);
      setProviders(providersPayload.providers ?? []);
      setAuditRuns(auditRunsPayload.auditRuns ?? []);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  async function handleSiteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingSite(true);

    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain: siteForm.domain,
          fingerprints: siteForm.fingerprints
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          name: siteForm.name,
          notes: siteForm.notes,
          searchHint: siteForm.searchHint,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save site");
      }

      setSiteForm(emptySiteForm);
      await refreshAll();
    } finally {
      setIsSavingSite(false);
    }
  }

  async function handleChatSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!chatInput.trim()) {
      return;
    }

    setIsSendingChat(true);

    try {
      const response = await fetch("/api/train-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: chatInput }),
      });

      if (!response.ok) {
        throw new Error("Chat failed");
      }

      const payload = (await response.json()) as {
        lessons?: TrainingLesson[];
        meta?: TrainerMeta;
        notes: TrainingNote[];
      };
      setLessons(payload.lessons ?? []);
      setNotes(payload.notes ?? []);
      setTrainerMeta(payload.meta ?? null);
      setChatInput("");
    } finally {
      setIsSendingChat(false);
    }
  }

  async function handleTrainingAuditSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!trainingAuditInput.trim()) {
      setTrainingAuditError("Paste lyrics before running a training audit.");
      return;
    }

    setIsRunningTrainingAudit(true);
    setTrainingAuditError(null);

    try {
      const response = await fetch("/api/training-audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: trainingAuditInput }),
      });
      const payload = (await response.json()) as {
        audit?: TrainingAuditResult;
        error?: string;
      };

      if (!response.ok || !payload.audit) {
        setTrainingAuditError(payload.error ?? "Training audit failed.");
        return;
      }

      setTrainingAudit(payload.audit);
    } finally {
      setIsRunningTrainingAudit(false);
    }
  }

  function handleUseTrainingAuditInChat() {
    if (!trainingAudit) {
      return;
    }

    const topCandidate = trainingAudit.topCandidate;
    const nextPrompt = [
      "Turn this audit result into reusable moderation guidance.",
      `Summary: ${trainingAudit.summary}`,
      topCandidate
        ? `Top candidate: ${topCandidate.name} (${topCandidate.domain})`
        : null,
      topCandidate
        ? `Line evidence: ${topCandidate.exactLineMatches} exact, ${topCandidate.nearLineMatches} near, ${topCandidate.longestConsecutiveBlock}-line block, ${topCandidate.matchPercentage}% coverage.`
        : null,
      trainingAudit.queries.length > 0
        ? `Queries used: ${trainingAudit.queries.join(" | ")}`
        : null,
      "Write the rule we should store, what weak results to distrust, and what site profile details to save.",
    ]
      .filter(Boolean)
      .join("\n");

    setChatInput(nextPrompt);
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      window.location.reload();
    } finally {
      setIsLoggingOut(false);
    }
  }

  function updateProvider<K extends keyof ProviderSetting>(
    providerId: string,
    key: K,
    value: ProviderSetting[K],
  ) {
    setProviders((current) =>
      current.map((provider) =>
        provider.id === providerId ? { ...provider, [key]: value } : provider,
      ),
    );
  }

  async function handleProviderSave(provider: ProviderSetting) {
    setSavingProviderId(provider.id);

    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(provider),
      });

      if (!response.ok) {
        throw new Error("Provider save failed");
      }

      const payload = (await response.json()) as { provider: ProviderSetting };
      setProviders((current) =>
        current.map((item) =>
          item.id === provider.id ? payload.provider : item,
        ),
      );
      await refreshAll();
    } finally {
      setSavingProviderId(null);
    }
  }

  async function handleDeleteNote(id: string) {
    setDeletingNoteId(id);

    try {
      const response = await fetch("/api/notes", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error("Training note delete failed");
      }

      await refreshAll();
    } finally {
      setDeletingNoteId(null);
    }
  }

  async function handleDeleteSite(id: string) {
    setDeletingSiteId(id);

    try {
      const response = await fetch("/api/sites", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error("Site delete failed");
      }

      await refreshAll();
    } finally {
      setDeletingSiteId(null);
    }
  }

  async function handleDeleteLesson(id: string) {
    setDeletingLessonId(id);

    try {
      const response = await fetch("/api/lessons", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error("Training lesson delete failed");
      }

      await refreshAll();
    } finally {
      setDeletingLessonId(null);
    }
  }

  async function handleSaveNoteAsLesson(noteId: string) {
    const noteIndex = notes.findIndex((item) => item.id === noteId);
    const note = notes[noteIndex];

    if (!note || note.author !== "assistant") {
      return;
    }

    const previousAdminNote = [...notes.slice(0, noteIndex)]
      .reverse()
      .find((item) => item.author === "admin");
    const sourceMessage = previousAdminNote?.content.trim() || note.content.trim();
    const relatedDomains = extractRelatedDomains(`${sourceMessage}\n${note.content}`);

    setSavingLessonRuleId(note.id);

    try {
      const response = await fetch("/api/lessons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confidence: "medium",
          evidenceSources: [],
          guidance: note.content.trim(),
          providerHints: [],
          relatedDomains,
          sourceMessage,
          title: buildLessonTitleFromSource(sourceMessage, relatedDomains),
        }),
      });

      if (!response.ok) {
        throw new Error("Training lesson save failed");
      }

      await refreshAll();
    } finally {
      setSavingLessonRuleId(null);
    }
  }

  async function handleApplyLessonAsSiteProfile(lesson: TrainingLesson) {
    const candidateDomains = [
      ...new Set([
        ...lesson.relatedDomains,
        ...lesson.evidenceSources.map((item) => getHostname(item)).filter(Boolean),
        ...extractRelatedDomains(`${lesson.guidance}\n${lesson.sourceMessage}`),
      ]),
    ];
    const domain = candidateDomains[0];

    if (!domain) {
      return;
    }

    const existingSite = sites.find((item) => item.domain === domain);
    const appendedNotes = [`Lesson: ${lesson.title}`, lesson.guidance]
      .filter(Boolean)
      .join("\n\n");

    setApplyingLessonId(lesson.id);

    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain,
          fingerprints: existingSite?.fingerprints ?? [],
          id: existingSite?.id,
          name: existingSite?.name ?? deriveProfileName(domain, lesson.title),
          notes: existingSite?.notes
            ? `${existingSite.notes}\n\n${appendedNotes}`
            : appendedNotes,
          searchHint: existingSite?.searchHint || buildLessonSearchHint(lesson, domain),
        }),
      });

      if (!response.ok) {
        throw new Error("Site profile save failed");
      }

      await refreshAll();
    } finally {
      setApplyingLessonId(null);
    }
  }

  function getProviderStats(providerId: string) {
    const matchingRuns = auditRuns.filter(
      (run) =>
        run.providerId === providerId || run.fallbackChain.includes(providerId),
    );

    return {
      errorCount: matchingRuns.filter(
        (run) => run.providerId === providerId && run.status === "error",
      ).length,
      lastRun: matchingRuns[0] ?? null,
      successCount: matchingRuns.filter(
        (run) => run.providerId === providerId && run.status !== "error",
      ).length,
    };
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-[28px] border border-[var(--border)] bg-[var(--panel)] px-5 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur xl:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1 text-xs font-semibold tracking-[0.24em] text-[var(--muted)] uppercase">
                <ShieldCheck className="size-3.5 text-[var(--accent)]" />
                Admin Trainer
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                TranscriptionMate Admin Portal
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                Train the audit behavior with notes, site fingerprints, provider
                routing policy, and live feedback from the main app.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void refreshAll()}
                disabled={isRefreshing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRefreshing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Refresh
              </button>
              <button
                type="button"
                onClick={() =>
                  setTheme((currentTheme) =>
                    currentTheme === "dark" ? "light" : "dark",
                  )
                }
                className="inline-flex items-center justify-center gap-2 self-start rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                {mounted && theme === "dark" ? (
                  <SunMedium className="size-4" />
                ) : (
                  <MoonStar className="size-4" />
                )}
                {mounted && theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              {authEnabled ? (
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={isLoggingOut}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:-translate-y-0.5 hover:border-rose-400 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoggingOut ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <LogOut className="size-4" />
                  )}
                  {isLoggingOut ? "Signing out..." : "Logout"}
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-6">
            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur xl:p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Search className="size-4 text-[var(--accent)]" />
                Training Audit Lab
              </div>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Run the same evidence-based site matching here before you teach the system. This compares fetched candidate pages line by line so your training notes are based on hard evidence.
              </p>

              <form className="mt-4 grid gap-3" onSubmit={handleTrainingAuditSubmit}>
                <textarea
                  value={trainingAuditInput}
                  onChange={(event) => setTrainingAuditInput(event.target.value)}
                  placeholder="Paste lyrics here to compare them against the top fetched candidate sites."
                  className="min-h-[180px] rounded-[24px] border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 font-mono text-sm leading-7 text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
                {trainingAuditError ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    {trainingAuditError}
                  </div>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={isRunningTrainingAudit}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRunningTrainingAudit ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                    {isRunningTrainingAudit ? "Auditing..." : "Run Training Audit"}
                  </button>
                  <button
                    type="button"
                    onClick={handleUseTrainingAuditInChat}
                    disabled={!trainingAudit}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-sm font-medium text-[var(--foreground)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <BrainCircuit className="size-4" />
                    Use Result in Trainer Chat
                  </button>
                </div>
              </form>

              {trainingAudit ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">
                          {trainingAudit.topCandidate
                            ? `Best match: ${trainingAudit.topCandidate.name}`
                            : "No site match yet"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                          {trainingAudit.summary}
                        </p>
                      </div>
                      {trainingAudit.providerId ? (
                        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                          {formatProviderName(trainingAudit.providerId)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                      {trainingAudit.notes}
                    </p>
                    {trainingAudit.queries.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {trainingAudit.queries.map((query) => (
                          <span
                            key={query}
                            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]"
                          >
                            {query}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {trainingAudit.candidateMatches.length > 0 ? (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
                      <p className="text-sm font-semibold">Candidate site matches</p>
                      <div className="mt-3 space-y-3">
                        {trainingAudit.candidateMatches.map((candidate, index) => (
                          <a
                            key={`${candidate.url}-${candidate.domain}-${index}`}
                            href={candidate.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`block rounded-2xl border px-4 py-4 text-sm transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] ${
                              index === 0
                                ? "border-emerald-400/40 bg-emerald-500/10"
                                : "border-[var(--border)]"
                            }`}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold">{candidate.name}</p>
                                  {index === 0 ? (
                                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-medium text-emerald-400">
                                      Best match
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                  {candidate.domain}
                                </p>
                                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                                  {candidate.title}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                                  Score {candidate.score}
                                </span>
                                <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                                  {candidate.fetched ? "Full page" : "Snippet fallback"}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-400">
                                {candidate.exactLineMatches} exact
                              </span>
                              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-400">
                                {candidate.nearLineMatches} near
                              </span>
                              <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                                {candidate.matchedLines}/{candidate.inputLineCount} matched
                              </span>
                              <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                                {candidate.matchPercentage}% coverage
                              </span>
                              <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                                {candidate.longestConsecutiveBlock}-line block
                              </span>
                              <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                                {formatProviderName(candidate.providerId)}
                              </span>
                            </div>

                            {candidate.sampleMatches.length > 0 ? (
                              <div className="mt-3 space-y-2">
                                {candidate.sampleMatches.slice(0, 3).map((match) => (
                                  <div
                                    key={`${candidate.url}-${match.inputLine}-${match.candidateLine}`}
                                    className="rounded-xl border border-[var(--border)] bg-black/10 px-3 py-3"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                          match.type === "exact"
                                            ? "bg-emerald-500/15 text-emerald-400"
                                            : "bg-amber-500/15 text-amber-400"
                                        }`}
                                      >
                                        {match.type === "exact" ? "Exact" : "Near"}
                                      </span>
                                      <span className="text-[11px] text-[var(--muted)]">
                                        {(match.similarity * 100).toFixed(0)}% similarity
                                      </span>
                                    </div>
                                    <p className="mt-2 font-mono text-xs leading-5 text-[var(--foreground)]">
                                      Input: {match.inputLine}
                                    </p>
                                    {match.type === "near" ? (
                                      <p className="mt-1 font-mono text-xs leading-5 text-[var(--muted)]">
                                        Site: {match.candidateLine}
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            {candidate.metadataHits.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {candidate.metadataHits.map((item) => (
                                  <span
                                    key={`${candidate.url}-${item}`}
                                    className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--foreground)]"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            {candidate.nonLyricSignals.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {candidate.nonLyricSignals.map((item) => (
                                  <span
                                    key={`${candidate.url}-${item}`}
                                    className="rounded-full bg-rose-500/15 px-3 py-1 text-xs text-rose-400"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur xl:p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <BrainCircuit className="size-4 text-[var(--accent)]" />
                Trainer Chat
              </div>

              <div className="min-h-[360px] space-y-3 rounded-[24px] border border-[var(--border)] bg-[var(--panel-strong)] p-4">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <LoaderCircle className="size-4 animate-spin" />
                    Loading training history...
                  </div>
                ) : notes.length > 0 ? (
                  notes.slice(-16).map((note) => (
                    <div
                      key={note.id}
                      className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                        note.author === "admin"
                          ? "bg-[var(--accent-soft)] text-[var(--foreground)]"
                          : "border border-[var(--border)] bg-black/10 text-[var(--foreground)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          {note.author}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {note.author === "assistant" ? (
                            <button
                              type="button"
                              onClick={() => void handleSaveNoteAsLesson(note.id)}
                              disabled={savingLessonRuleId === note.id}
                              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingLessonRuleId === note.id ? (
                                <LoaderCircle className="size-3.5 animate-spin" />
                              ) : (
                                <BrainCircuit className="size-3.5" />
                              )}
                              Save as Lesson Rule
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void handleDeleteNote(note.id)}
                            disabled={deletingNoteId === note.id}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] transition hover:border-rose-400 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingNoteId === note.id ? (
                              <LoaderCircle className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                            Remove
                          </button>
                        </div>
                      </div>
                      {note.author === "assistant" ? (
                        <MarkdownContent
                          className="mt-3 text-[var(--foreground)]"
                          value={note.content}
                        />
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap">{note.content}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
                    Start chatting to teach the audit system what to look for,
                    what to distrust, and how provider routing should behave.
                  </div>
                )}
              </div>

              <form className="mt-4 flex flex-col gap-3" onSubmit={handleChatSubmit}>
                <textarea
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Example: When quoted first-line search fails but heuristic confidence is low, keep Tavily enabled and fall back to exact-match manual verification links."
                  className="min-h-[120px] rounded-[24px] border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
                <button
                  type="submit"
                  disabled={isSendingChat}
                  className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSendingChat ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {isSendingChat ? "Saving..." : "Send Training Note"}
                </button>
                {trainerMeta ? (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span
                      className={`rounded-full px-3 py-1 ${
                        trainerMeta.liveAiEnabled
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-rose-500/15 text-rose-400"
                      }`}
                    >
                      {trainerMeta.liveAiEnabled
                        ? `AI: ${trainerMeta.modelUsed ?? "configured"}`
                        : "AI: missing"}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 ${
                        trainerMeta.liveWebEnabled
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-rose-500/15 text-rose-400"
                      }`}
                    >
                      {trainerMeta.liveWebEnabled
                        ? `Web: ${formatProviderName(
                            trainerMeta.webProviderUsed,
                          )} (${trainerMeta.webEvidenceCount})`
                        : "Web: missing"}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 ${
                        trainerMeta.lessonCreated
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-[var(--accent-soft)] text-[var(--foreground)]"
                      }`}
                    >
                      {trainerMeta.lessonCreated
                        ? "Structured lesson saved"
                        : "No lesson saved"}
                    </span>
                  </div>
                ) : null}
              </form>
            </div>

            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur xl:p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <BrainCircuit className="size-4 text-[var(--accent)]" />
                Structured Lessons
              </div>

              <div className="space-y-3">
                {lessons.length > 0 ? (
                  lessons.slice(0, 12).map((lesson) => (
                    <div
                      key={lesson.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{lesson.title}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {formatTime(lesson.updatedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs ${
                              lesson.confidence === "high"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : lesson.confidence === "medium"
                                  ? "bg-amber-500/15 text-amber-400"
                                  : "bg-[var(--accent-soft)] text-[var(--foreground)]"
                            }`}
                          >
                            {lesson.confidence} confidence
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleApplyLessonAsSiteProfile(lesson)}
                            disabled={applyingLessonId === lesson.id}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {applyingLessonId === lesson.id ? (
                              <LoaderCircle className="size-3.5 animate-spin" />
                            ) : (
                              <Database className="size-3.5" />
                            )}
                            Apply as Site Profile
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteLesson(lesson.id)}
                            disabled={deletingLessonId === lesson.id}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] transition hover:border-rose-400 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingLessonId === lesson.id ? (
                              <LoaderCircle className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                            Remove
                          </button>
                        </div>
                      </div>

                      <MarkdownContent
                        className="mt-3 text-sm text-[var(--foreground)]"
                        value={lesson.guidance}
                      />
                      <p className="mt-3 rounded-2xl border border-[var(--border)] bg-black/10 px-3 py-3 font-mono text-xs leading-5 text-[var(--muted)]">
                        {lesson.sourceMessage}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {lesson.relatedDomains.map((domain) => (
                          <span
                            key={`${lesson.id}-${domain}`}
                            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]"
                          >
                            {domain}
                          </span>
                        ))}
                        {lesson.providerHints.map((providerId) => (
                          <span
                            key={`${lesson.id}-${providerId}`}
                            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]"
                          >
                            {formatProviderName(providerId)}
                          </span>
                        ))}
                      </div>
                      {lesson.evidenceSources.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {lesson.evidenceSources.slice(0, 4).map((source) => (
                            <a
                              key={`${lesson.id}-${source}`}
                              href={source}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                            >
                              {getHostname(source)}
                              <ArrowUpRight className="size-3.5" />
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
                    Structured lessons created from trainer chat will appear here.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur xl:p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Settings2 className="size-4 text-[var(--accent)]" />
                Provider Router
              </div>
              <p className="mb-4 text-sm leading-6 text-[var(--muted)]">
                This panel controls backend routing policy only. Provider API
                keys still stay in environment variables for the deployed apps.
              </p>

              <div className="space-y-4">
                {providers.length > 0 ? (
                  providers.map((provider) => {
                    const stats = getProviderStats(provider.providerId);

                    return (
                      <div
                        key={provider.id}
                        className="rounded-[24px] border border-[var(--border)] bg-[var(--panel-strong)] p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-base font-semibold">{provider.name}</p>
                            <p className="text-xs text-[var(--muted)]">
                              {provider.providerId}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                provider.enabled
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-rose-500/15 text-rose-400"
                              }`}
                            >
                              {provider.enabled ? "Enabled" : "Disabled"}
                            </span>
                            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                              {stats.successCount} success
                            </span>
                            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                              {stats.errorCount} error
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-2 text-sm">
                            <span className="text-[var(--muted)]">Display name</span>
                            <input
                              value={provider.name}
                              onChange={(event) =>
                                updateProvider(provider.id, "name", event.target.value)
                              }
                              className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                            />
                          </label>
                          <label className="grid gap-2 text-sm">
                            <span className="text-[var(--muted)]">Priority</span>
                            <input
                              type="number"
                              min={1}
                              value={provider.priority}
                              onChange={(event) =>
                                updateProvider(
                                  provider.id,
                                  "priority",
                                  Number(event.target.value || 1),
                                )
                              }
                              className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                            />
                          </label>
                          <label className="grid gap-2 text-sm">
                            <span className="text-[var(--muted)]">Timeout (ms)</span>
                            <input
                              type="number"
                              min={1000}
                              step={500}
                              value={provider.timeoutMs}
                              onChange={(event) =>
                                updateProvider(
                                  provider.id,
                                  "timeoutMs",
                                  Number(event.target.value || 8000),
                                )
                              }
                              className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                            />
                          </label>
                          <label className="grid gap-2 text-sm">
                            <span className="text-[var(--muted)]">Daily soft limit</span>
                            <input
                              type="number"
                              min={0}
                              value={provider.dailySoftLimit}
                              onChange={(event) =>
                                updateProvider(
                                  provider.id,
                                  "dailySoftLimit",
                                  Number(event.target.value || 0),
                                )
                              }
                              className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                            />
                          </label>
                          <label className="grid gap-2 text-sm">
                            <span className="text-[var(--muted)]">Mode</span>
                            <select
                              value={provider.mode}
                              onChange={(event) =>
                                updateProvider(
                                  provider.id,
                                  "mode",
                                  event.target.value as ProviderMode,
                                )
                              }
                              className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                            >
                              <option value="always">Always search</option>
                              <option value="low-confidence-only">
                                Low confidence only
                              </option>
                            </select>
                          </label>
                          <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <label className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
                              <input
                                type="checkbox"
                                checked={provider.enabled}
                                onChange={(event) =>
                                  updateProvider(
                                    provider.id,
                                    "enabled",
                                    event.target.checked,
                                  )
                                }
                              />
                              Enabled
                            </label>
                            <label className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
                              <input
                                type="checkbox"
                                checked={provider.allowFallback}
                                onChange={(event) =>
                                  updateProvider(
                                    provider.id,
                                    "allowFallback",
                                    event.target.checked,
                                  )
                                }
                              />
                              Allow fallback
                            </label>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-xs leading-5 text-[var(--muted)]">
                            {stats.lastRun ? (
                              <>
                                Last audit: {formatTime(stats.lastRun.createdAt)}
                                {" · "}
                                {stats.lastRun.status}
                              </>
                            ) : (
                              "No audit runs recorded for this provider yet."
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleProviderSave(provider)}
                            disabled={savingProviderId === provider.id}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingProviderId === provider.id ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                              <Route className="size-4" />
                            )}
                            {savingProviderId === provider.id
                              ? "Saving..."
                              : "Save Provider Settings"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
                    No providers have been configured yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur xl:p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Database className="size-4 text-[var(--accent)]" />
                Site Profiles
              </div>

              <form className="grid gap-3" onSubmit={handleSiteSubmit}>
                <input
                  value={siteForm.name}
                  onChange={(event) =>
                    setSiteForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Site name"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
                <input
                  value={siteForm.domain}
                  onChange={(event) =>
                    setSiteForm((current) => ({ ...current, domain: event.target.value }))
                  }
                  placeholder="Domain"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
                <input
                  value={siteForm.searchHint}
                  onChange={(event) =>
                    setSiteForm((current) => ({
                      ...current,
                      searchHint: event.target.value,
                    }))
                  }
                  placeholder='Search hint, e.g. site:example.com "first line"'
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
                <input
                  value={siteForm.fingerprints}
                  onChange={(event) =>
                    setSiteForm((current) => ({
                      ...current,
                      fingerprints: event.target.value,
                    }))
                  }
                  placeholder="Fingerprints, comma separated"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
                <textarea
                  value={siteForm.notes}
                  onChange={(event) =>
                    setSiteForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Moderation notes about this site"
                  className="min-h-[120px] rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
                <button
                  type="submit"
                  disabled={isSavingSite}
                  className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingSite ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  {isSavingSite ? "Saving..." : "Save Site Profile"}
                </button>
              </form>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur xl:p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Search className="size-4 text-[var(--accent)]" />
                Known Sites
              </div>

              <div className="space-y-3">
                {sites.length > 0 ? (
                  sites.map((site) => (
                    <div
                      key={site.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{site.name}</p>
                          <p className="text-xs text-[var(--muted)]">{site.domain}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--foreground)]">
                            {site.fingerprints.length} fingerprints
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleDeleteSite(site.id)}
                            disabled={deletingSiteId === site.id}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] transition hover:border-rose-400 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingSiteId === site.id ? (
                              <LoaderCircle className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                            Remove
                          </button>
                        </div>
                      </div>
                      {site.searchHint ? (
                        <p className="mt-3 text-sm text-[var(--muted)]">
                          Search hint: {site.searchHint}
                        </p>
                      ) : null}
                      {site.notes ? (
                        <MarkdownContent
                          className="mt-2 text-sm text-[var(--foreground)]"
                          value={site.notes}
                        />
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
                    No site profiles yet. Add your first site so the audit prompt can
                    learn from it.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur xl:p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Activity className="size-4 text-[var(--accent)]" />
                Recent Audit Runs
              </div>

              <div className="space-y-3">
                {auditRuns.length > 0 ? (
                  auditRuns.slice(0, 12).map((run) => (
                    <div
                      key={run.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            run.status === "error"
                              ? "bg-rose-500/15 text-rose-400"
                              : run.status === "fallback"
                                ? "bg-amber-500/15 text-amber-400"
                                : "bg-emerald-500/15 text-emerald-400"
                          }`}
                        >
                          {run.status.toUpperCase()}
                        </span>
                        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                          {run.providerId
                            ? formatProviderName(run.providerId)
                            : "Heuristic only"}
                        </span>
                        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                          {run.searchResultCount} results
                        </span>
                        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                          {run.spamProbability}% spam probability
                        </span>
                      </div>

                      <p className="mt-3 text-sm font-medium">
                        {run.likelySourceName ?? "No likely source named"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatTime(run.createdAt)}
                      </p>

                      {run.queries.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {run.queries.map((query) => (
                            <span
                              key={query}
                              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]"
                            >
                              {query}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {run.webEvidence[0] ? (
                        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-black/10 px-4 py-3">
                          <p className="text-sm font-semibold">
                            {run.webEvidence[0].title}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {getHostname(run.webEvidence[0].url)}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                            {run.webEvidence[0].snippet}
                          </p>
                        </div>
                      ) : null}

                      {run.notes ? (
                        <MarkdownContent
                          className="mt-3 text-sm text-[var(--muted)]"
                          value={run.notes}
                        />
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
                    Audit runs from the main site will appear here once shared storage is connected.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur xl:p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="size-4 text-[var(--accent)]" />
                Feedback Inbox
              </div>

              <div className="space-y-3">
                {feedback.length > 0 ? (
                  feedback.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            item.verdict === "yes"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-rose-500/15 text-rose-400"
                          }`}
                        >
                          {item.verdict.toUpperCase()}
                        </span>
                        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                          {item.spamProbability}% spam probability
                        </span>
                        {item.providerId ? (
                          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                            {formatProviderName(item.providerId)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm font-medium">{item.auditSummary}</p>
                      <p className="mt-2 font-mono text-xs leading-5 text-[var(--muted)]">
                        {item.inputExcerpt}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
                    Feedback from the main site will show up here after users answer
                    “Fetched Correctly?”.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur xl:p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Route className="size-4 text-[var(--accent)]" />
                Retrieval Notes
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Use shared Redis in both apps so feedback, audit runs, and provider settings stay synced.",
                  "Set provider API keys in each deployed app separately. This panel only controls policy and ordering.",
                  "Keep Tavily on basic search depth to stretch credits for public usage.",
                  "Use low-confidence-only mode if you want the router to spend credits only when heuristics are unsure.",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm text-[var(--foreground)]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
