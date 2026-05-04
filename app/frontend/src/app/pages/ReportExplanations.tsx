import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, ArrowLeft, BarChart3, CheckCircle2, ClipboardList, FileText, Info, Stethoscope } from 'lucide-react';
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

type ModelInsight = {
  timestamp: string;
  csvType: 'invasive' | 'ftir' | null;
  predictionValue: number;
  riskScore: number;
  riskLevel: string;
  limeSummary: string | null;
  shapSummary: string | null;
  topLimeFeatures: unknown[];
  topShapFeatures: unknown[];
  featureNotes: Array<{
    feature?: string;
    value?: number | string | null;
    feature_value?: number | string | null;
    weight?: number | string | null;
    mean_abs_shap?: number | string | null;
    mean_shap?: number | string | null;
    meaning?: string;
  }>;
};

type FeatureChartRow = {
  name: string;
  fullName: string;
  score: number;
  magnitude: number;
  direction: 'raises' | 'lowers';
};

const panelClass =
  'rounded-[2rem] border border-white/80 bg-white/85 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-black/25';
const cardClass =
  'rounded-[2rem] border-white/80 bg-white/90 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20';
const mutedPanelClass =
  'rounded-3xl border border-slate-100 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/60';

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
        guidance: 'Prioritize clinician review and consider confirmatory evaluation.',
      };
    case 'moderate':
    case 'medium':
      return {
        badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/45 dark:text-amber-200',
        ring: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/45 dark:text-amber-200 dark:ring-amber-900/50',
        guidance: 'Review the result with a healthcare professional and plan follow-up based on clinical context.',
      };
    case 'low':
      return {
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/45 dark:text-emerald-200',
        ring: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/45 dark:text-emerald-200 dark:ring-emerald-900/50',
        guidance: 'Continue routine monitoring and discuss screening frequency with a healthcare professional.',
      };
    default:
      return {
        badge: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200',
        ring: 'bg-slate-50 text-slate-700 ring-slate-100 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-800',
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

function getFeatureNoteValue(note: ModelInsight['featureNotes'][number]) {
  return note.value ?? note.feature_value ?? note.weight ?? note.mean_abs_shap ?? note.mean_shap;
}

function getFeatureNoteMeaning(note: ModelInsight['featureNotes'][number]) {
  if (note.mean_abs_shap !== undefined || note.mean_shap !== undefined) {
    return note.meaning || 'Model-wide feature importance from SHAP.';
  }

  if (note.weight !== undefined) {
    const weight = getNumericValue(note.weight);
    if (weight !== null) {
      return note.meaning || (weight >= 0
        ? 'Pushes this prediction toward the higher-risk class in the local model explanation.'
        : 'Pushes this prediction toward the lower-risk class in the local model explanation.');
    }
  }

  return note.meaning || 'Not specified';
}

function renderFormattedExplanation(text: string) {
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

export function ReportExplanations() {
  const [insight, setInsight] = useState<ModelInsight | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('latestModelInsight');
    if (!raw) return;

    try {
      setInsight(JSON.parse(raw));
    } catch {
      setInsight(null);
    }
  }, []);

  const limeChartData = useMemo(() => buildChartData(insight?.topLimeFeatures), [insight?.topLimeFeatures]);
  const shapChartData = useMemo(() => buildChartData(insight?.topShapFeatures), [insight?.topShapFeatures]);

  if (!insight) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className={`${panelClass} p-6`}>
          <div className="mb-2 flex items-center gap-3 text-sm font-medium text-sky-700 dark:text-sky-300">
            <FileText className="h-5 w-5" />
            Report explanations
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white">No report explanation yet</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Run a file-upload assessment first. When the model returns explainability summaries, the clinical explanation will appear here.
          </p>
        </div>

        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/35">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-300" />
            <div className="text-sm leading-6 text-amber-900 dark:text-amber-100">
              <p className="font-semibold">Explanation unavailable</p>
              <p className="mt-1">This page depends on the latest saved model insight from a CSV-based assessment.</p>
              <Button asChild className="mt-4 rounded-2xl bg-slate-950 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100">
                <Link to="/dashboard/risk-assessment">Go to risk assessment</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const riskTone = getRiskTone(insight.riskLevel);
  const modelLabel = insight.csvType === 'invasive' ? 'PSA / invasive clinical model' : 'FTIR spectral model';
  const isFtirReport = insight.csvType === 'ftir';
  const assessedAt = insight.timestamp
    ? new Date(insight.timestamp).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not recorded';

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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className={`${panelClass} p-6`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3 text-sm font-medium text-sky-700 dark:text-sky-300">
              <Stethoscope className="h-5 w-5" />
              Clinical report explanation
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white">Report explanations</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              A clinician-facing explanation of the latest model output, focused on interpretation, supporting factors, and limits of the prediction.
            </p>
          </div>
          <Button asChild variant="outline" className="h-11 rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800">
            <Link to="/dashboard/risk-assessment">
              <ArrowLeft className="h-4 w-4" />
              Back to assessment
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.82fr]">
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-slate-950 dark:text-white">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-8 ${riskTone.ring}`}>
                {insight.riskScore}
              </span>
              Assessment interpretation
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Current result from the most recent saved model prediction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className={mutedPanelClass}>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Risk category</p>
                <Badge className={`mt-3 rounded-full border px-3 py-1 ${riskTone.badge}`}>{insight.riskLevel}</Badge>
              </div>
              <div className={mutedPanelClass}>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Probability</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{(insight.predictionValue * 100).toFixed(2)}%</p>
              </div>
              <div className={mutedPanelClass}>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Model source</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-950 dark:text-white">{modelLabel}</p>
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
              <span className="text-right font-medium text-slate-900 dark:text-slate-100">{assessedAt}</span>
            </div>
            <div className="flex justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/70">
              <span className="text-slate-500 dark:text-slate-400">Risk score</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{insight.riskScore}/100</span>
            </div>
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
              LIME summary, describing factors that influenced this individual prediction
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insight.limeSummary ? (
              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">
                {renderFormattedExplanation(insight.limeSummary)}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No patient-specific explanation was returned for this prediction.</p>
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
              SHAP summary, describing broader model feature importance when available
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insight.shapSummary ? (
              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">
                {renderFormattedExplanation(insight.shapSummary)}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No model-wide explanation was returned for this prediction.</p>
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
                ? 'FTIR spectra are compressed into PCA components before prediction. These LIME values explain those model components, not raw wavenumber peaks.'
                : 'LIME contributions by absolute impact. Blue raises the model estimate; green lowers it.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isFtirReport && (
              <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm leading-6 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-100">
                Raw FTIR files contain thousands of wavenumber columns. ProstAPP reduces them into sector PCA features first, so a direct “PSA-style” feature contribution is not available unless we add a PCA-to-wavenumber back-mapping step.
              </div>
            )}
            {renderChart(limeChartData, isFtirReport ? 'No FTIR component contributions were returned for this prediction.' : 'No LIME features found.')}
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="text-slate-950 dark:text-white">Key model-wide drivers</CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              SHAP importance by absolute impact. Use this as model context, not patient-specific proof.
            </CardDescription>
          </CardHeader>
          <CardContent>{renderChart(shapChartData, 'No SHAP features found.')}</CardContent>
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
          {insight.featureNotes?.length ? (
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
                  {insight.featureNotes.slice(0, 15).map((note, idx) => (
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
            <p className="text-sm text-slate-500 dark:text-slate-400">No feature notes found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
