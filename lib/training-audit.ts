export type TrainingAuditWebEvidence = {
  providerId: string;
  score?: number | null;
  snippet: string;
  title: string;
  url: string;
};

export type TrainingAuditCandidateMatchSample = {
  candidateLine: string;
  inputLine: string;
  similarity: number;
  type: "exact" | "near";
};

export type TrainingAuditCandidateMatch = {
  comparisonSource: "page" | "snippet";
  domain: string;
  exactLineMatches: number;
  fetched: boolean;
  inputLineCount: number;
  longestConsecutiveBlock: number;
  matchPercentage: number;
  matchedLines: number;
  metadataHits: string[];
  name: string;
  nearLineMatches: number;
  nonLyricSignals: string[];
  providerId: string;
  sampleMatches: TrainingAuditCandidateMatchSample[];
  score: number;
  title: string;
  url: string;
};

export type TrainingAuditResult = {
  candidateMatches: TrainingAuditCandidateMatch[];
  notes: string;
  providerChain: string[];
  providerId: string | null;
  queries: string[];
  summary: string;
  topCandidate: TrainingAuditCandidateMatch | null;
  webEvidence: TrainingAuditWebEvidence[];
};

function isComparableLyricsLine(line: string) {
  return (
    line.length >= 8 &&
    !line.startsWith("#") &&
    !/^\[[^\]]+\]$/.test(line) &&
    !/^\([^)]+\)$/.test(line)
  );
}

function getQueryPriority(line: string) {
  const words = line
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const uniqueWords = new Set(words).size;

  return uniqueWords * 4 + Math.min(line.length, 80) / 6;
}

export function getComparableLyricLines(rawLyrics: string) {
  return rawLyrics
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => isComparableLyricsLine(line));
}

export function getSearchableLines(rawLyrics: string) {
  return getComparableLyricLines(rawLyrics)
    .sort((left, right) => getQueryPriority(right) - getQueryPriority(left))
    .slice(0, 3);
}
