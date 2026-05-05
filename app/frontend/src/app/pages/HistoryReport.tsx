import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileText,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  clearPredictionHistoryForCurrentUser,
  getPredictionHistoryForCurrentUser,
  loadPredictionHistoryForCurrentUser,
  type FeatureNote,
  type PredictionHistoryEntry,
} from '../historyStore';

type FeatureChartRow = {
  name: string;
  fullName: string;
  score: number;
  magnitude: number;
  direction: 'raises' | 'lowers';
};

const shellClass =
  'rounded-[2rem] border border-white/80 bg-white/90 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-black/25';
const cardClass =
  'rounded-[2rem] border-white/80 bg-white/90 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20';
const mutedPanelClass =
  'rounded-3xl border border-slate-100 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/60';

function sourceLabel(source: PredictionHistoryEntry['source']) {
  if (source === 'form') return 'Manual assessment';
  if (source === 'ml-invasive') return 'PSA / invasive model';
  return 'FTIR / non-invasive model';
}

function getNumericValue(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatListValue(value: unknown) {
  const numeric = getNumericValue(value);
  return numeric !== null ? numeric.toFixed(4) : 'N/A';
}

function formatFeatureName(value: unknown) {
  const name = typeof value === 'string' && value.trim() ? value.trim() : 'Unknown feature';

  return name
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRiskTone(level: string) {
  switch (level?.toLowerCase()) {
    case 'high':
      return {
        badge: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/45 dark:text-rose-200',
        ring: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/45 dark:text-rose-200 dark:ring-rose-900/50',
        accent: 'border-l-rose-500',
        guidance: 'Prioritize clinician review and consider confirmatory evaluation.',
      };
    case 'moderate':
    case 'medium':
      return {
        badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/45 dark:text-amber-200',
        ring: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/45 dark:text-amber-200 dark:ring-amber-900/50',
        accent: 'border-l-amber-500',
        guidance: 'Review the result with a healthcare professional and plan follow-up based on clinical context.',
      };
    case 'low':
      return {
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/45 dark:text-emerald-200',
        ring: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/45 dark:text-emerald-200 dark:ring-emerald-900/50',
        accent: 'border-l-emerald-500',
        guidance: 'Continue routine monitoring and discuss screening frequency with a healthcare professional.',
      };
    default:
      return {
        badge: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200',
        ring: 'bg-slate-50 text-slate-700 ring-slate-100 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-800',
        accent: 'border-l-slate-400',
        guidance: 'Review this output with a healthcare professional before making care decisions.',
      };
  }
}

function normalizeFeature(item: unknown) {
  if (Array.isArray(item)) {
    return {
      feature: item[0],
      score: getNumericValue(item[1]) ?? 0,
    };
  }

  if (item && typeof item === 'object') {
    const feature = item as Record<string, unknown>;
    const score =
      getNumericValue(feature.weight) ??
      getNumericValue(feature.mean_shap) ??
      getNumericValue(feature.mean_abs_shap) ??
      getNumericValue(feature.score) ??
      getNumericValue(feature.value) ??
      0;

    return {
      feature: feature.feature ?? feature.name ?? feature.label,
      score,
    };
  }

  return null;
}

function buildChartData(features: unknown[] = []) {
  if (!Array.isArray(features)) {
    return [];
  }

  return features
    .slice(0, 8)
    .map(normalizeFeature)
    .filter((feature): feature is { feature: unknown; score: number } => Boolean(feature))
    .map(({ feature, score }) => ({
      name: formatFeatureName(feature).slice(0, 18),
      fullName: formatFeatureName(feature),
      score,
      magnitude: Math.abs(score),
      direction: score >= 0 ? 'raises' : 'lowers',
    })) satisfies FeatureChartRow[];
}

function getFeatureNoteValue(note: FeatureNote) {
  return note.value ?? note.feature_value ?? note.weight ?? note.mean_abs_shap ?? note.mean_shap;
}

function getFeatureNoteMeaning(note: FeatureNote) {
  if (note.mean_abs_shap !== undefined || note.mean_shap !== undefined) {
    return note.meaning || 'Model-wide feature importance from SHAP.';
  }

  if (note.weight !== undefined) {
    const weight = getNumericValue(note.weight);
    if (weight !== null) {
      return note.meaning || (weight >= 0
        ? 'Pushes this prediction toward the higher-risk class in the local explanation.'
        : 'Pushes this prediction toward the lower-risk class in the local explanation.');
    }
  }

  return note.meaning || 'Not specified';
}

function renderFormattedSummary(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold text-slate-950 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return part;
  });
}

function toPercent(value: number | null | undefined) {
  return typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : 'Not available';
}

export function HistoryReport() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState<PredictionHistoryEntry[]>(() => getPredictionHistoryForCurrentUser());
  const [isLoading, setIsLoading] = useState(entries.length === 0);
  const reportId = searchParams.get('report');
  const [selectedId, setSelectedId] = useState<string | null>(reportId || entries[0]?.id || null);
  const [isRailOpen, setIsRailOpen] = useState(true);

  useEffect(() => {
    loadPredictionHistoryForCurrentUser()
      .then((data) => {
        setEntries(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!entries.length) {
      setSelectedId(null);
      return;
    }

    if (reportId && entries.some((entry) => entry.id === reportId)) {
      setSelectedId(reportId);
      return;
    }

    setSelectedId((current) => (current && entries.some((entry) => entry.id === current) ? current : entries[0].id));
  }, [entries, reportId]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null,
    [entries, selectedId],
  );

  useEffect(() => {
    if (!selectedEntry) {
      return;
    }

    if (searchParams.get('report') === selectedEntry.id) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('report', selectedEntry.id);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, selectedEntry, setSearchParams]);

  const riskTone = getRiskTone(selectedEntry?.riskLevel || '');
  const isFtirReport = selectedEntry?.source === 'ml-ftir';
  const limeChartData = useMemo(() => buildChartData(selectedEntry?.topLimeFeatures), [selectedEntry?.topLimeFeatures]);
  const shapChartData = useMemo(() => buildChartData(selectedEntry?.topShapFeatures), [selectedEntry?.topShapFeatures]);

  const handleSelectEntry = (entryId: string) => {
    setSelectedId(entryId);
  };

  const handleClearHistory = async () => {
    await clearPredictionHistoryForCurrentUser();
    setEntries([]);
    setSelectedId(null);
    setSearchParams({}, { replace: true });
  };

  const chartTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload as FeatureChartRow;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <p className="font-semibold text-slate-950 dark:text-white">{data.fullName}</p>
        <p className="mt-1 text-slate-600 dark:text-slate-300">Contribution: {formatListValue(data.score)}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Direction: {data.direction === 'raises' ? 'raises model risk estimate' : 'lowers model risk estimate'}
        </p>
      </div>
    );
  };

  const renderChart = (data: FeatureChartRow[], emptyText: string) => {
    if (!data.length) {
      return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>;
    }

    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 48, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <XAxis
            dataKey="name"
            angle={-35}
            textAnchor="end"
            height={72}
            tick={{ fontSize: 12, fill: 'currentColor' }}
            className="text-slate-500 dark:text-slate-400"
          />
          <YAxis tick={{ fontSize: 12, fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400" />
          <Tooltip content={chartTooltip} />
          <Bar dataKey="magnitude" radius={[8, 8, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.fullName} fill={entry.direction === 'raises' ? '#0284c7' : '#10b981'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 animate-in fade-in duration-500">
        <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-6 animate-pulse">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <div className="h-5 w-48 rounded-lg bg-slate-200 dark:bg-slate-800/80"></div>
              <div className="h-10 w-64 rounded-xl bg-slate-200 dark:bg-slate-800/80"></div>
              <div className="h-12 w-full max-w-3xl rounded-xl bg-slate-100 dark:bg-slate-800/50"></div>
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-32 rounded-xl bg-slate-200 dark:bg-slate-800/80"></div>
              <div className="h-10 w-32 rounded-xl bg-slate-200 dark:bg-slate-800/80"></div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-6 h-[calc(100vh-14rem)] animate-pulse">
            <div className="h-6 w-32 rounded-lg bg-slate-200 dark:bg-slate-800/80 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-24 w-full rounded-2xl bg-slate-100 dark:bg-slate-800/50"></div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-6 h-80 animate-pulse">
                <div className="flex items-center gap-4 mb-8">
                  <div className="h-12 w-12 rounded-2xl bg-slate-200 dark:bg-slate-800/80"></div>
                  <div className="h-6 w-48 rounded-lg bg-slate-200 dark:bg-slate-800/80"></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 w-full rounded-2xl bg-slate-100 dark:bg-slate-800/50"></div>
                  ))}
                </div>
              </div>
              <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-6 h-80 animate-pulse">
                <div className="h-6 w-40 rounded-lg bg-slate-200 dark:bg-slate-800/80 mb-8"></div>
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-12 w-full rounded-2xl bg-slate-100 dark:bg-slate-800/50"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className={`${shellClass} p-6`}>
          <div className="mb-2 flex items-center gap-3 text-sm font-medium text-sky-700 dark:text-sky-300">
            <FileText className="h-5 w-5" />
            History report
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white">No saved reports yet</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Run a manual, PSA-based, or FTIR-based assessment first. Saved reports will appear here with their full interpretation and explainability details.
          </p>
        </div>

        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/35">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-300" />
            <div className="text-sm leading-6 text-amber-900 dark:text-amber-100">
              <p className="font-semibold">History unavailable</p>
              <p className="mt-1">This workspace populates after a prediction has been saved to your account history.</p>
              <Button onClick={() => navigate('/dashboard/risk-assessment')} className="mt-4 rounded-2xl bg-slate-950 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100">
                Go to risk assessment
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className={`${shellClass} p-6`}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3 text-sm font-medium text-sky-700 dark:text-sky-300">
              <Stethoscope className="h-5 w-5" />
              Unified report workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white">History Report</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Review every saved report in one place. Each entry now opens with its clinical interpretation, patient-specific explanation, model-wide context, and supporting feature tables.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={() => navigate('/dashboard/risk-assessment')}
            >
              Run new assessment
            </Button>
            <Button
              variant="outline"
              className="rounded-2xl border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-200 dark:hover:bg-rose-950/55"
              onClick={handleClearHistory}
            >
              <Trash2 className="h-4 w-4" />
              Clear history
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/85 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Report navigation</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isRailOpen ? 'The saved report panel is visible.' : 'The saved report panel is hidden so the report can use the full width.'}
          </p>
        </div>
        <Button
          variant="outline"
          className="h-10 rounded-2xl border-slate-200 bg-white px-4 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          onClick={() => setIsRailOpen((value) => !value)}
        >
          {isRailOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          {isRailOpen ? 'Collapse saved reports' : 'Open saved reports'}
        </Button>
      </div>

      <div className={`grid gap-6 ${isRailOpen ? 'xl:grid-cols-[280px_minmax(0,1fr)]' : 'xl:grid-cols-1'}`}>
        {isRailOpen && (
        <Card className={`${cardClass} xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]`}>
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-950 dark:text-white">Saved reports</CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Select a report to open its full explanation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 overflow-y-auto pb-6">
            {entries.map((entry) => {
              const isActive = selectedEntry?.id === entry.id;
              const tone = getRiskTone(entry.riskLevel);
              const hasExplainability = Boolean(entry.limeSummary || entry.shapSummary || entry.topLimeFeatures?.length || entry.topShapFeatures?.length);

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleSelectEntry(entry.id)}
                  className={`w-full rounded-[1.35rem] border p-3 text-left transition-all ${
                    isActive
                      ? 'border-sky-300 bg-sky-50 shadow-sm dark:border-sky-700 dark:bg-sky-950/25'
                      : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-semibold leading-5 text-slate-950 dark:text-slate-100">{sourceLabel(entry.source)}</p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(entry.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ring-4 ${tone.ring}`}>
                      <span className="text-xs font-semibold">{entry.riskScore}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge className={`rounded-full border px-2.5 py-0.5 text-[11px] ${tone.badge}`}>{entry.riskLevel}</Badge>
                    {typeof entry.predictionValue === 'number' && (
                      <Badge variant="outline" className="rounded-full border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        {toPercent(entry.predictionValue)}
                      </Badge>
                    )}
                    {hasExplainability && (
                      <Badge variant="outline" className="rounded-full border-sky-200 px-2.5 py-0.5 text-[11px] text-sky-700 dark:border-sky-800 dark:text-sky-300">
                        Explained
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
        )}

        {selectedEntry ? (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <Card className={`${cardClass} border-l-4 ${riskTone.accent}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-slate-950 dark:text-white">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-8 ${riskTone.ring}`}>
                      {selectedEntry.riskScore}
                    </span>
                    Assessment interpretation
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    Interpretation for the selected saved report
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className={mutedPanelClass}>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Risk category</p>
                      <Badge className={`mt-3 rounded-full border px-3 py-1 ${riskTone.badge}`}>{selectedEntry.riskLevel}</Badge>
                    </div>
                    <div className={mutedPanelClass}>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Probability</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{toPercent(selectedEntry.predictionValue)}</p>
                    </div>
                    <div className={mutedPanelClass}>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Model source</p>
                      <p className="mt-3 text-sm font-semibold leading-6 text-slate-950 dark:text-white">{sourceLabel(selectedEntry.source)}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-sky-100 bg-sky-50/80 p-5 dark:border-sky-900/60 dark:bg-sky-950/35">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-sky-700 dark:text-sky-300" />
                      <div>
                        <p className="font-semibold text-sky-950 dark:text-sky-100">Suggested clinical framing</p>
                        <p className="mt-2 text-sm leading-6 text-sky-900 dark:text-sky-200">{riskTone.guidance}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                    <Info className="h-5 w-5 text-sky-700 dark:text-sky-300" />
                    Report context
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    Details that should accompany interpretation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/70">
                    <span className="text-slate-500 dark:text-slate-400">Generated</span>
                    <span className="text-right font-medium text-slate-900 dark:text-slate-100">{new Date(selectedEntry.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/70">
                    <span className="text-slate-500 dark:text-slate-400">Risk score</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{selectedEntry.riskScore}/100</span>
                  </div>
                  <div className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/70">
                    <span className="text-slate-500 dark:text-slate-400">Assessment source</span>
                    <span className="text-right font-medium text-slate-900 dark:text-slate-100">{sourceLabel(selectedEntry.source)}</span>
                  </div>
                  {selectedEntry.csvFileName && (
                    <div className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/70">
                      <span className="text-slate-500 dark:text-slate-400">Uploaded file</span>
                      <span className="text-right font-medium text-slate-900 dark:text-slate-100">{selectedEntry.csvFileName}</span>
                    </div>
                  )}
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100">
                    This is decision support only. It should be reviewed with patient history, examination findings, PSA context, imaging, and clinician judgement.
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                    <ClipboardList className="h-5 w-5 text-sky-700 dark:text-sky-300" />
                    Patient-specific explanation
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    LIME summary for this individual report
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedEntry.limeSummary ? (
                    <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">
                      {renderFormattedSummary(selectedEntry.limeSummary)}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No patient-specific explanation was returned for this report.</p>
                  )}
                </CardContent>
              </Card>

              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                    <BarChart3 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                    Model-wide explanation
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    SHAP summary and broader model context when available
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedEntry.shapSummary ? (
                    <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">
                      {renderFormattedSummary(selectedEntry.shapSummary)}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No model-wide explanation was returned for this report.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle className="text-slate-950 dark:text-white">
                    {isFtirReport ? 'Key FTIR component drivers' : 'Key patient-specific drivers'}
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    {isFtirReport
                      ? 'FTIR spectra are compressed into PCA components before prediction. These values explain those model components, not raw wavenumber peaks.'
                      : 'LIME contributions by absolute impact. Blue raises the model estimate; green lowers it.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isFtirReport && (
                    <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm leading-6 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-100">
                      Raw FTIR files contain thousands of wavenumber columns. ProstAPP reduces them into sector PCA features first, so a direct peak-by-peak explanation is not available without a PCA back-mapping layer.
                    </div>
                  )}
                  {renderChart(
                    limeChartData,
                    isFtirReport
                      ? 'No FTIR component contributions were returned for this report.'
                      : 'No patient-specific contribution features were returned for this report.',
                  )}
                </CardContent>
              </Card>

              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle className="text-slate-950 dark:text-white">Key model-wide drivers</CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    SHAP importance by absolute impact. Use this as model context, not patient-specific proof.
                  </CardDescription>
                </CardHeader>
                <CardContent>{renderChart(shapChartData, 'No SHAP features found for this report.')}</CardContent>
              </Card>
            </div>

            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                  <FileText className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  Feature interpretation notes
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Feature values and plain-language meanings used to support the explanation text
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedEntry.featureNotes?.length ? (
                  <div className="overflow-x-auto rounded-3xl border border-slate-100 dark:border-slate-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                          <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Feature</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Value</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Clinical meaning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedEntry.featureNotes.slice(0, 15).map((note, idx) => (
                          <tr key={`${note.feature}-${idx}`} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/60">
                            <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-100">{formatFeatureName(note.feature)}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatListValue(getFeatureNoteValue(note))}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{getFeatureNoteMeaning(note)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No feature interpretation notes were returned for this report.</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
