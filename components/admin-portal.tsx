"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  BrainCircuit,
  Database,
  LoaderCircle,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  SunMedium,
  MoonStar,
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
  spamProbability: number;
  verdict: "yes" | "no";
};

type Theme = "light" | "dark";

const emptySiteForm = {
  domain: "",
  fingerprints: "",
  name: "",
  notes: "",
  searchHint: "",
};

export function AdminPortal() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const [sites, setSites] = useState<SiteProfile[]>([]);
  const [notes, setNotes] = useState<TrainingNote[]>([]);
  const [feedback, setFeedback] = useState<AuditFeedback[]>([]);
  const [siteForm, setSiteForm] = useState(emptySiteForm);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);

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
    setIsLoading(true);

    try {
      const [sitesResponse, notesResponse, feedbackResponse] = await Promise.all([
        fetch("/api/sites"),
        fetch("/api/notes"),
        fetch("/api/feedback"),
      ]);

      const sitesPayload = (await sitesResponse.json()) as { sites: SiteProfile[] };
      const notesPayload = (await notesResponse.json()) as { notes: TrainingNote[] };
      const feedbackPayload = (await feedbackResponse.json()) as { feedback: AuditFeedback[] };

      setSites(sitesPayload.sites ?? []);
      setNotes(notesPayload.notes ?? []);
      setFeedback(feedbackPayload.feedback ?? []);
    } finally {
      setIsLoading(false);
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

      const payload = (await response.json()) as { notes: TrainingNote[] };
      setNotes(payload.notes ?? []);
      setChatInput("");
    } finally {
      setIsSendingChat(false);
    }
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
                Train the audit behavior with notes, site fingerprints, and live feedback from the main app.
              </p>
            </div>

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
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        {note.author}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
                    Start chatting to teach the audit system what to look for, what to distrust, and how to search better.
                  </div>
                )}
              </div>

              <form className="mt-4 flex flex-col gap-3" onSubmit={handleChatSubmit}>
                <textarea
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Example: When the text mentions Vijay Paul or 'Original lyrics of', strongly prefer iLyricsHub."
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
              </form>
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
                    setSiteForm((current) => ({ ...current, searchHint: event.target.value }))
                  }
                  placeholder="Search hint, e.g. search quoted first line on this domain"
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
                        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--foreground)]">
                          {site.fingerprints.length} fingerprints
                        </span>
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
                    No site profiles yet. Add your first site so the audit prompt can learn from it.
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
                      </div>
                      <p className="mt-3 text-sm font-medium">{item.auditSummary}</p>
                      <p className="mt-2 font-mono text-xs leading-5 text-[var(--muted)]">
                        {item.inputExcerpt}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
                    Feedback from the main site will show up here after users answer “Fetched Correctly?”.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
