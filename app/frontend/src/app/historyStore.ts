import { getStoredUser } from './auth/session';
import { buildApiUrl } from './lib/api';

export type RiskLevel = 'Low' | 'Moderate' | 'High';

export type PredictionSource = 'form' | 'ml-invasive' | 'ml-ftir';

export type FeatureNote = {
  feature?: string;
  displayFeature?: string | null;
  display_feature?: string | null;
  value?: number | string | null;
  feature_value?: number | string | null;
  displayValue?: string | null;
  display_value?: string | null;
  weight?: number | string | null;
  mean_abs_shap?: number | string | null;
  mean_shap?: number | string | null;
  meaning?: string;
};

export interface PredictionHistoryEntry {
  id: string;
  createdAt: string;
  source: PredictionSource;
  riskLevel: RiskLevel;
  riskScore: number;
  color: 'green' | 'yellow' | 'red';
  predictionValue?: number | null;
  csvFileName?: string | null;
  limeSummary?: string | null;
  shapSummary?: string | null;
  predictionClass?: number | string | null;
  csvType?: 'invasive' | 'ftir' | null;
  topLimeFeatures?: unknown[];
  topShapFeatures?: unknown[];
  featureNotes?: FeatureNote[];
}

type HistoryByUser = Record<string, PredictionHistoryEntry[]>;

const STORAGE_KEY = 'predictionHistoryByUser';
const MAX_HISTORY_ITEMS = 50;
function getCurrentUserKey() {
  const user = getStoredUser();
  if (user?.id) return `id:${String(user.id)}`;
  if (user?.email) return `email:${String(user.email).toLowerCase()}`;

  return 'guest';
}

function getCurrentUserIdentity() {
  const user = getStoredUser();
  return {
    userId: user?.id || '',
    userEmail: user?.email?.toLowerCase() || '',
  };
}

function readHistoryStore(): HistoryByUser {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeHistoryStore(value: HistoryByUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function setPredictionHistoryForCurrentUser(items: PredictionHistoryEntry[]) {
  const store = readHistoryStore();
  store[getCurrentUserKey()] = items.slice(0, MAX_HISTORY_ITEMS);
  writeHistoryStore(store);
}

function sortEntries(items: PredictionHistoryEntry[]) {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getPredictionHistoryForCurrentUser(): PredictionHistoryEntry[] {
  const store = readHistoryStore();
  const key = getCurrentUserKey();
  const items = store[key];

  return Array.isArray(items) ? sortEntries(items) : [];
}

async function fetchReportHistoryFromApi() {
  const { userId, userEmail } = getCurrentUserIdentity();
  if (!userEmail && !userId) {
    return null;
  }

  const query = new URLSearchParams();
  if (userId) query.set('userId', userId);
  if (userEmail) query.set('userEmail', userEmail);

  const url = buildApiUrl(`/api/reports?${query.toString()}`);
  if (!url) {
    return null;
  }

  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Failed to load report history.');
  }

  return Array.isArray(payload.reports) ? sortEntries(payload.reports) : [];
}

async function persistReportToApi(entry: PredictionHistoryEntry) {
  const { userId, userEmail } = getCurrentUserIdentity();
  if (!userEmail) {
    return null;
  }

  const url = buildApiUrl('/api/reports');
  if (!url) {
    return null;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...entry,
      userId,
      userEmail,
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Failed to save report history.');
  }

  return payload.report as PredictionHistoryEntry;
}

async function clearReportHistoryFromApi() {
  const { userId, userEmail } = getCurrentUserIdentity();
  if (!userEmail && !userId) {
    return;
  }

  const url = buildApiUrl('/api/reports');
  if (!url) {
    return;
  }

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      userEmail,
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Failed to clear report history.');
  }
}

export async function loadPredictionHistoryForCurrentUser(): Promise<PredictionHistoryEntry[]> {
  try {
    const reports = await fetchReportHistoryFromApi();
    if (reports) {
      setPredictionHistoryForCurrentUser(reports);
      return reports;
    }
  } catch (error) {
    console.error('Failed to load report history from API:', error);
  }

  return getPredictionHistoryForCurrentUser();
}

export function savePredictionHistoryEntry(
  input: Omit<PredictionHistoryEntry, 'createdAt'> & Partial<Pick<PredictionHistoryEntry, 'id'>>,
): PredictionHistoryEntry {
  const store = readHistoryStore();
  const key = getCurrentUserKey();
  const existing = Array.isArray(store[key]) ? store[key] : [];
  const id =
    input.id ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const entry: PredictionHistoryEntry = {
    ...input,
    id,
    createdAt: new Date().toISOString(),
  };

  store[key] = sortEntries([entry, ...existing]).slice(0, MAX_HISTORY_ITEMS);
  writeHistoryStore(store);

  persistReportToApi(entry)
    .then((remoteEntry) => {
      if (!remoteEntry) return;
      const current = getPredictionHistoryForCurrentUser().filter((item) => item.id !== entry.id);
      setPredictionHistoryForCurrentUser(sortEntries([remoteEntry, ...current]));
    })
    .catch((error) => {
      console.error('Failed to persist report history to API:', error);
    });

  return entry;
}

export async function clearPredictionHistoryForCurrentUser() {
  const store = readHistoryStore();
  const key = getCurrentUserKey();
  store[key] = [];
  writeHistoryStore(store);

  try {
    await clearReportHistoryFromApi();
  } catch (error) {
    console.error('Failed to clear report history from API:', error);
  }
}

export function toAssessmentSummary(entry: PredictionHistoryEntry) {
  return {
    id: entry.id,
    date: entry.createdAt,
    riskLevel: entry.riskLevel,
    riskScore: entry.riskScore,
    color: entry.color,
  };
}
