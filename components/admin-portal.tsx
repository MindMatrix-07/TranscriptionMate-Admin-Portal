"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  BrainCircuit,
  Database,
  LoaderCircle,
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
  liveAiEnabled: boolean;
  liveWebEnabled: boolean;
  modelUsed: "gemini" | "openai" | null;
  webEvidenceCount: number;
  webProviderUsed: string | null;
};

const emptySiteForm = {
  domain: "",
  fingerprints: "",
  name: "",
  notes: "",
  searchHint: "",
};

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

export function AdminPortal() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const [sites, setSites] = useState<SiteProfile[]>([]);
  const [notes, setNotes] = useState<TrainingNote[]>([]);
  const [feedback, setFeedback] = useState<AuditFeedback[]>([]);
  const [providers, setProviders] = useState<ProviderSetting[]>([]);
  const [auditRuns, setAuditRuns] = useState<AuditRun[]>([]);
  const [siteForm, setSiteForm] = useState(emptySiteForm);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null);
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
        notesResponse,
        feedbackResponse,
        providersResponse,
        auditRunsResponse,
      ] = await Promise.all([
        fetch("/api/sites"),
        fetch("/api/notes"),
        fetch("/api/feedback"),
        fetch("/api/providers"),
        fetch("/api/audit-runs"),
      ]);

      const sitesPayload = (await sitesResponse.json()) as { sites: SiteProfile[] };
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
        meta?: TrainerMeta;
        notes: TrainingNote[];
      };
      setNotes(payload.notes ?? []);
      setTrainerMeta(payload.meta ?? null);
      setChatInput("");
    } finally {
      setIsSendingChat(false);
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
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-6">
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
                      <p className="mt-1 whitespace-pre-wrap">{note.content}</p>
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
                  </div>
                ) : null}
              </form>
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
                        <p className="mt-2 text-sm text-[var(--foreground)]">{site.notes}</p>
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
                        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                          {run.notes}
                        </p>
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
