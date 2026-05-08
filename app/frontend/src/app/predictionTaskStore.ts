export type PredictionTaskStatus = 'idle' | 'running' | 'success' | 'error';

export type PredictionTaskKind = 'manual-invasive' | 'csv-invasive' | 'csv-ftir';

export interface PredictionTaskSnapshot {
  id: string | null;
  status: PredictionTaskStatus;
  kind: PredictionTaskKind | null;
  startedAt: string | null;
  finishedAt: string | null;
  csvFileName: string | null;
  result: any | null;
  error: string | null;
}

const idleSnapshot: PredictionTaskSnapshot = {
  id: null,
  status: 'idle',
  kind: null,
  startedAt: null,
  finishedAt: null,
  csvFileName: null,
  result: null,
  error: null,
};

let snapshot: PredictionTaskSnapshot = idleSnapshot;
const listeners = new Set<() => void>();

function createTaskId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribePredictionTask(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getPredictionTaskSnapshot() {
  return snapshot;
}

export function startPredictionTask(input: {
  kind: PredictionTaskKind;
  csvFileName?: string | null;
}) {
  const id = createTaskId();
  snapshot = {
    id,
    status: 'running',
    kind: input.kind,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    csvFileName: input.csvFileName || null,
    result: null,
    error: null,
  };
  emit();

  return id;
}

export function resolvePredictionTask(id: string, result: any) {
  if (snapshot.id !== id) {
    return;
  }

  snapshot = {
    ...snapshot,
    status: 'success',
    finishedAt: new Date().toISOString(),
    result,
    error: null,
  };
  emit();
}

export function rejectPredictionTask(id: string, error: unknown) {
  if (snapshot.id !== id) {
    return;
  }

  snapshot = {
    ...snapshot,
    status: 'error',
    finishedAt: new Date().toISOString(),
    result: null,
    error: error instanceof Error ? error.message : 'Unknown error',
  };
  emit();
}

export function clearPredictionTask() {
  snapshot = idleSnapshot;
  emit();
}
