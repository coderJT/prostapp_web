import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  AlertCircle,
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  FlaskConical,
  Gauge,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Stethoscope,
  Trash2,
  Waves,
} from 'lucide-react';
import {
  Area,
  AreaChart,
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
import { Input } from '../components/ui/input';
import {
  clearPredictionHistoryForCurrentUser,
  getPredictionHistoryForCurrentUser,
  loadPredictionHistoryForCurrentUser,
  type FeatureNote,
  type PredictionHistoryEntry,
} from '../historyStore';
import {
  formatFeatureName,
  formatFeatureNoteValue,
  formatModelNumber,
  getFeatureNoteMeaning,
} from '../lib/featureNotes';

type FeatureChartRow = {
  name: string;
  fullName: string;
  score: number;
  magnitude: number;
  direction: 'raises' | 'lowers';
};

type ReportSourceFilter = 'all' | PredictionHistoryEntry['source'];

const shellClass =
  'rounded-[2rem] border border-white/80 bg-white/90 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-black/25';
const cardClass =
  'rounded-[1.5rem] border border-slate-100 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900';
const mutedPanelClass =
  'border-b border-slate-100 pb-4 last:border-b-0 last:pb-0 dark:border-slate-800';

const ftirRegions = [
  { range: '3500-3000', label: 'Proteins and hydration', meaning: 'protein N-H and water/O-H signals' },
  { range: '3000-2800', label: 'Lipids', meaning: 'lipid C-H stretching' },
  { range: '1740-1720', label: 'Lipid carbonyl', meaning: 'lipid C=O stretching' },
  { range: '1700-1470', label: 'Protein Amide I/II', meaning: 'protein secondary-structure signals' },
  { range: '1470-1200', label: 'Proteins and lipids', meaning: 'CH2/CH3 deformation and Amide III' },
  { range: '1200-1000', label: 'Carbohydrates and nucleic acids', meaning: 'C-O/C-C and phosphate-related signals' },
  { range: '1000-700', label: 'Nucleic acids and sugars', meaning: 'DNA/RNA phosphate and saccharide vibrations' },
  { range: '700-400', label: 'Phosphates and lipid skeleton', meaning: 'phosphate bending and lipid skeletal vibrations' },
];

function sourceLabel(source: PredictionHistoryEntry['source']) {
  if (source === 'form') return 'Manual assessment';
  if (source === 'ml-invasive') return 'PSA / invasive model';
  return 'FTIR / non-invasive model';
}

function sourceMeta(source: PredictionHistoryEntry['source']) {
  if (source === 'form') {
    return {
      label: 'Manual',
      description: 'Guided entry',
      icon: ClipboardList,
      className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    };
  }

  if (source === 'ml-invasive') {
    return {
      label: 'PSA',
      description: 'Invasive model',
      icon: Gauge,
      className: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200',
    };
  }

  return {
    label: 'FTIR',
    description: 'Spectral model',
    icon: FlaskConical,
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200',
  };
}

function getNumericValue(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatListValue(value: unknown) {
  return formatModelNumber(value);
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

function riskPlainLanguage(entry: PredictionHistoryEntry | null) {
  if (!entry) return '';
  const probability = toPercent(entry.predictionValue);
  if (entry.riskLevel === 'High') {
    return `This result is in the higher modeled concern range (${probability}). It does not diagnose cancer, but it is a signal that the report should be reviewed carefully with the patient’s PSA history, symptoms, imaging, and previous biopsy context.`;
  }
  if (entry.riskLevel === 'Moderate') {
    return `This result is in an intermediate modeled range (${probability}). It is not a diagnosis; it means the model found enough signal that the result should be interpreted with the rest of the clinical picture.`;
  }
  return `This result is in the lower modeled range (${probability}). It is reassuring as a model signal, but it does not replace clinical follow-up when symptoms, PSA trend, examination, MRI, or family history are concerning.`;
}

function modalityPlainLanguage(entry: PredictionHistoryEntry | null) {
  if (!entry) return '';
  if (entry.source === 'ml-ftir') {
    return 'This FTIR result comes from a urinary extracellular-vesicle spectrum. The model is reading a biochemical fingerprint across many infrared wavenumbers, then compressing it into PCA components before classification.';
  }
  if (entry.source === 'ml-invasive') {
    return 'This PSA/invasive result comes from clinical and demographic fields. Treat important features as decision-support signals, not as standalone reasons for biopsy or treatment.';
  }
  return 'This manual assessment is a simplified risk record. It is useful for tracking, but it does not include the model explanation depth available from CSV-based reports.';
}

function clinicalMeaningPoints(entry: PredictionHistoryEntry | null) {
  if (!entry) return [];

  if (entry.source === 'ml-ftir') {
    return [
      'A higher FTIR probability means the urinary EV spectrum resembles patterns the model learned from prostate-cancer-associated samples. It should be interpreted as a screening-support signal, not proof of tumour presence or grade.',
      'Urinary EV FTIR can be attractive because it is non-invasive, but spectra are affected by sample collection, EV isolation, hydration, preprocessing, instrument variation, and the small research datasets used to train models.',
      'Because the classifier uses PCA-compressed spectral features, individual “Column” drivers are not the same as PSA, Gleason score, MRI PI-RADS, or a named biomarker. They represent combined biochemical variance across spectral regions.',
    ];
  }

  if (entry.source === 'ml-invasive') {
    return [
      'A higher PSA/invasive-model probability means the clinical variables resemble patterns associated with higher modeled need for invasive assessment in the training data.',
      'PSA is sensitive but not specific: benign prostatic enlargement, prostatitis, urinary infection, recent ejaculation, catheterization, cystoscopy, or biopsy can raise PSA without cancer.',
      'A lower modeled probability does not exclude clinically significant prostate cancer when PSA is rising, DRE is abnormal, MRI is suspicious, or family history is strong.',
    ];
  }

  return [
    'Manual entries are useful for continuity and patient education, but they are not a substitute for a validated clinical risk calculator or clinician assessment.',
    'Interpret any risk category alongside age, PSA trend, symptoms, DRE, MRI, previous biopsy findings, family history, and patient preferences.',
  ];
}

function nextStepPoints(entry: PredictionHistoryEntry | null) {
  if (!entry) return [];
  const common = [
    'Confirm the input data quality before acting on the result, especially uploaded CSV values, units, missing fields, and whether the sample belongs to the correct patient.',
    'Discuss the result with a clinician rather than using the score alone to decide on biopsy, imaging, treatment, or reassurance.',
  ];

  if (entry.riskLevel === 'High') {
    return [
      'Review whether the patient has red-flag context: rapidly rising PSA, abnormal DRE, suspicious MRI, previous atypia/HGPIN, strong family history, or concerning urinary/bone symptoms.',
      'Consider whether repeat PSA, urinalysis/infection treatment, prostate volume adjustment, MRI, or biopsy discussion is clinically appropriate.',
      ...common,
    ];
  }

  if (entry.riskLevel === 'Moderate') {
    return [
      'Look for factors that could move concern up or down: PSA density/velocity, recent infection or instrumentation, DRE/MRI findings, age, comorbidity, and family history.',
      'A repeat measurement or additional clinical context may be more informative than acting on one model output.',
      ...common,
    ];
  }

  return [
    'Continue routine follow-up if the wider clinical picture is reassuring, but do not ignore persistent symptoms, rising PSA, abnormal DRE, or suspicious imaging.',
    ...common,
  ];
}

function explanationSections(text?: string | null) {
  if (!text) return {};
  const sections: Record<string, string[]> = {};
  let current = 'Details';
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const heading = trimmed.replace(/:$/, '');
    if (/^(summary|patient takeaway|feature interpretation|what influenced the result|ftir interpretation|suggested next context|clinical caution|details)$/i.test(heading)) {
      current = heading;
      sections[current] = sections[current] || [];
      return;
    }
    sections[current] = sections[current] || [];
    sections[current].push(trimmed.replace(/^[-•]\s*/, ''));
  });
  return sections;
}

function getSectionText(sections: Record<string, string[]>, names: string[]) {
  const key = Object.keys(sections).find((section) => names.some((name) => section.toLowerCase() === name.toLowerCase()));
  return key ? sections[key] : [];
}

function featureDirectionLabel(value: unknown) {
  const numeric = getNumericValue(value);
  if (numeric === null) return 'influenced the model';
  return numeric >= 0 ? 'raised the modeled estimate' : 'lowered the modeled estimate';
}

function pcaComponentNumber(value: unknown) {
  const match = String(value || '').match(/Column_(\d+)/);
  return match ? Number(match[1]) : null;
}

function inferFtirRegionFromComponent(feature: unknown) {
  const component = pcaComponentNumber(feature);
  if (component === null) return null;
  const region = ftirRegions[Math.min(ftirRegions.length - 1, Math.floor(component / 13))];
  return region ? `${region.range} cm-1, ${region.label.toLowerCase()}` : null;
}

function topFeatureCards(entry: PredictionHistoryEntry | null) {
  if (!entry?.topLimeFeatures?.length) return [];
  return entry.topLimeFeatures
    .slice(0, 5)
    .map(normalizeFeature)
    .filter((feature): feature is { feature: unknown; score: number } => Boolean(feature))
    .map(({ feature, score }) => ({
      label: formatFeatureName(feature),
      direction: featureDirectionLabel(score),
      score,
      ftirRegion: entry.source === 'ml-ftir' ? inferFtirRegionFromComponent(feature) : null,
    }));
}

function formatReportDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatReportTime(value: string) {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function reportMatchesQuery(entry: PredictionHistoryEntry, query: string) {
  if (!query.trim()) return true;

  const normalizedQuery = query.trim().toLowerCase();
  return [
    sourceLabel(entry.source),
    sourceMeta(entry.source).label,
    entry.riskLevel,
    entry.csvFileName || '',
    entry.predictionClass ?? '',
    entry.id,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery);
}

export function HistoryReport() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState<PredictionHistoryEntry[]>(() => getPredictionHistoryForCurrentUser());
  const [isLoading, setIsLoading] = useState(entries.length === 0);
  const reportId = searchParams.get('report');
  const [selectedId, setSelectedId] = useState<string | null>(reportId || entries[0]?.id || null);
  const [isRailOpen, setIsRailOpen] = useState(true);
  const [reportQuery, setReportQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<ReportSourceFilter>('all');

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
  const limeSections = useMemo(() => explanationSections(selectedEntry?.limeSummary), [selectedEntry?.limeSummary]);
  const shapSections = useMemo(() => explanationSections(selectedEntry?.shapSummary), [selectedEntry?.shapSummary]);
  const selectedFeatureCards = useMemo(() => topFeatureCards(selectedEntry), [selectedEntry]);
  const selectedClinicalMeaning = useMemo(() => clinicalMeaningPoints(selectedEntry), [selectedEntry]);
  const selectedNextSteps = useMemo(() => nextStepPoints(selectedEntry), [selectedEntry]);
  const ftirSpectrumData = selectedEntry?.ftirSpectrumData || [];
  const sourceCounts = useMemo(
    () => ({
      all: entries.length,
      form: entries.filter((entry) => entry.source === 'form').length,
      'ml-invasive': entries.filter((entry) => entry.source === 'ml-invasive').length,
      'ml-ftir': entries.filter((entry) => entry.source === 'ml-ftir').length,
    }),
    [entries],
  );
  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const matchesSource = sourceFilter === 'all' || entry.source === sourceFilter;
        return matchesSource && reportMatchesQuery(entry, reportQuery);
      }),
    [entries, reportQuery, sourceFilter],
  );
  const groupedEntries = useMemo(
    () =>
      filteredEntries.reduce<Array<{ day: string; reports: PredictionHistoryEntry[] }>>((groups, entry) => {
        const day = formatReportDay(entry.createdAt);
        const existingGroup = groups.find((group) => group.day === day);
        if (existingGroup) {
          existingGroup.reports.push(entry);
        } else {
          groups.push({ day, reports: [entry] });
        }
        return groups;
      }, []),
    [filteredEntries],
  );

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
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Report index</p>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              {filteredEntries.length} of {entries.length} saved reports shown
            </p>
          </div>
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

      <div className={`grid gap-6 ${isRailOpen ? 'xl:grid-cols-[380px_minmax(0,1fr)]' : 'xl:grid-cols-1'}`}>
        {isRailOpen && (
          <Card className={`${cardClass} overflow-hidden xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]`}>
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 pb-4 dark:border-slate-800 dark:bg-slate-950/45">
              <CardTitle className="text-slate-950 dark:text-white">Saved reports</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Find the exact assessment before opening the full clinical explanation.
              </CardDescription>
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={reportQuery}
                  onChange={(event) => setReportQuery(event.target.value)}
                  placeholder="Search source, file, risk..."
                  className="h-11 rounded-2xl border-slate-200 bg-white pl-9 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([
                  ['all', 'All'],
                  ['ml-invasive', 'PSA'],
                  ['ml-ftir', 'FTIR'],
                  ['form', 'Manual'],
                ] as Array<[ReportSourceFilter, string]>).map(([value, label]) => {
                  const isActive = sourceFilter === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSourceFilter(value)}
                      className={`rounded-2xl border px-3 py-2 text-left text-xs transition ${
                        isActive
                          ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-white'
                      }`}
                    >
                      <span className="block font-semibold">{label}</span>
                      <span className={`mt-0.5 block ${isActive ? 'text-white/70 dark:text-slate-500' : 'text-slate-400 dark:text-slate-500'}`}>
                        {sourceCounts[value]} report{sourceCounts[value] === 1 ? '' : 's'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="h-full overflow-y-auto p-0 pb-6">
              {groupedEntries.length ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {groupedEntries.map((group) => (
                    <div key={group.day} className="py-4">
                      <div className="sticky top-0 z-10 flex items-center gap-2 bg-white/95 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur dark:bg-slate-900/95 dark:text-slate-400">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {group.day}
                      </div>
                      <div className="space-y-2 px-3">
                        {group.reports.map((entry) => {
                          const isActive = selectedEntry?.id === entry.id;
                          const tone = getRiskTone(entry.riskLevel);
                          const meta = sourceMeta(entry.source);
                          const SourceIcon = meta.icon;
                          const hasExplainability = Boolean(entry.limeSummary || entry.shapSummary || entry.topLimeFeatures?.length || entry.topShapFeatures?.length);

                          return (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => handleSelectEntry(entry.id)}
                              className={`group w-full rounded-2xl border p-3 text-left transition-all ${
                                isActive
                                  ? 'border-sky-300 bg-sky-50 shadow-sm dark:border-sky-700 dark:bg-sky-950/25'
                                  : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-950/70'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${meta.className}`}>
                                  <SourceIcon className="h-5 w-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{sourceLabel(entry.source)}</p>
                                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                        {entry.csvFileName || meta.description}
                                      </p>
                                    </div>
                                    <ChevronRight className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition ${isActive ? 'text-sky-600' : 'group-hover:translate-x-0.5 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                                  </div>

                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{formatReportTime(entry.createdAt)}</span>
                                    <Badge className={`rounded-full border px-2.5 py-0.5 text-[11px] ${tone.badge}`}>
                                      {entry.riskLevel} {entry.riskScore}/100
                                    </Badge>
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
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5">
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
                    No reports match the current search and source filter.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {selectedEntry ? (
          <div className="space-y-6">
            <div className="grid gap-4 2xl:grid-cols-[1fr_0.9fr]">
              <Card className={cardClass}>
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

                  <div className="rounded-2xl bg-sky-50/80 p-5 dark:bg-sky-950/35">
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
                  <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
                    This is decision support only. It should be reviewed with patient history, examination findings, PSA context, imaging, and clinician judgement.
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                  <Stethoscope className="h-5 w-5 text-sky-700 dark:text-sky-300" />
                  Doctor-readable explanation
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Plain-language interpretation first, model mechanics second
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="border-b border-slate-100 pb-5 dark:border-slate-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Plain English result</p>
                  <p className="mt-3 text-base leading-7 text-slate-900 dark:text-slate-100">{riskPlainLanguage(selectedEntry)}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{modalityPlainLanguage(selectedEntry)}</p>
                </div>

                <div className="border-b border-slate-100 pb-5 dark:border-slate-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Medical interpretation</p>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    {selectedClinicalMeaning.map((point) => (
                      <p key={point}>{point}</p>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-sky-700 dark:text-sky-300" />
                      <h3 className="font-semibold text-slate-950 dark:text-white">What influenced this report</h3>
                    </div>
                    {selectedFeatureCards.length ? (
                      <div className="grid gap-3">
                        {selectedFeatureCards.map((feature) => (
                          <div key={`${feature.label}-${feature.score}`} className="border-b border-slate-100 pb-4 last:border-b-0 dark:border-slate-800">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <p className="font-medium text-slate-950 dark:text-slate-100">{feature.label}</p>
                              <Badge variant="outline" className="w-fit rounded-full border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                {formatListValue(feature.score)}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                              This factor {feature.direction}. Magnitude means model influence, not clinical severity.
                            </p>
                            {feature.ftirRegion && (
                              <p className="mt-2 text-xs leading-5 text-emerald-700 dark:text-emerald-300">
                                Approximate spectral context: {feature.ftirRegion}. PCA components are compressed patterns, so this is a broad biochemical clue, not a named diagnostic marker.
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="border-l-2 border-slate-200 pl-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        No feature-level driver list was returned for this report.
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                      <h3 className="font-semibold text-slate-950 dark:text-white">Clinical context to check</h3>
                    </div>
                    <div className="rounded-2xl bg-sky-50/80 p-4 text-sm leading-6 text-sky-900 dark:bg-sky-950/35 dark:text-sky-100">
                      <ul className="space-y-2">
                        {selectedNextSteps.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </div>
                    {(getSectionText(limeSections, ['Patient takeaway', 'Summary']).length > 0 || getSectionText(limeSections, ['Suggested next context']).length > 0) && (
                      <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">LLM clinical summary</p>
                        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                          {[...getSectionText(limeSections, ['Patient takeaway', 'Summary']), ...getSectionText(limeSections, ['Suggested next context']).slice(0, 2)].slice(0, 4).map((line, index) => (
                            <p key={`${line}-${index}`}>{renderFormattedSummary(line)}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {isFtirReport && (
              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                    <Waves className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                    FTIR spectrum and biochemical regions
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    Raw urinary EV absorbance pattern before PCA compression
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {ftirSpectrumData.length ? (
                    <div className="rounded-2xl bg-emerald-50/40 p-4 dark:bg-emerald-950/20">
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={ftirSpectrumData} margin={{ top: 8, right: 18, bottom: 12, left: 0 }}>
                            <defs>
                              <linearGradient id="historySpectrumGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                            <XAxis dataKey="wavenumber" tick={{ fontSize: 11 }} label={{ value: 'Wavenumber (cm-1)', position: 'insideBottom', offset: -5, fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 11 }} label={{ value: 'Absorbance', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                            <Tooltip
                              contentStyle={{ borderRadius: '1rem', border: '1px solid #d1d5db', fontSize: 12 }}
                              formatter={(value: number) => [value.toFixed(4), 'Absorbance']}
                              labelFormatter={(label: number) => `${label} cm-1`}
                            />
                            <Area type="monotone" dataKey="absorbance" stroke="#059669" strokeWidth={1.5} fill="url(#historySpectrumGrad)" dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-amber-50 p-5 text-sm leading-6 text-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
                      This saved report does not include raw FTIR spectrum points. New FTIR reports will store a downsampled spectrum so this graph can be shown here.
                    </div>
                  )}

                  <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
                    {ftirRegions.map((region) => (
                      <div key={region.range} className="border-t border-slate-100 pt-4 dark:border-slate-800">
                        <p className="text-sm font-semibold text-slate-950 dark:text-white">{region.range} cm-1</p>
                        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">{region.label}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{region.meaning}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                    <p>
                      In practical terms, FTIR does not measure a single cancer marker. It captures a biochemical fingerprint from urinary extracellular vesicles; cancer-associated changes may alter protein, lipid, carbohydrate, nucleic-acid, phosphate, and hydration-related absorbance patterns. The model then learns statistical differences in those patterns.
                    </p>
                    <p className="mt-3">
                      This is why FTIR results are best used as an additional triage or research-support signal. A suspicious FTIR result should be reconciled with PSA, DRE, MRI, biopsy history, urine infection status, and sample quality before any clinical decision is made.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 2xl:grid-cols-2">
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
                    <div className="mb-4 rounded-2xl bg-sky-50/80 px-4 py-3 text-sm leading-6 text-sky-900 dark:bg-sky-950/35 dark:text-sky-100">
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
                <CardContent className="space-y-4">
                  {renderChart(shapChartData, 'No SHAP features found for this report.')}
                  {getSectionText(shapSections, ['Patient takeaway', 'Summary', 'Clinical caution']).length > 0 && (
                    <div className="border-t border-slate-100 pt-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:text-slate-300">
                      {getSectionText(shapSections, ['Patient takeaway', 'Summary', 'Clinical caution']).slice(0, 3).map((line, index) => (
                        <p key={`${line}-${index}`}>{renderFormattedSummary(line)}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
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
                  <div className="overflow-x-auto">
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
                            <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-100">{formatFeatureName(note)}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatFeatureNoteValue(note)}</td>
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
