import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Activity,
  Download,
  FileSpreadsheet,
  Share2,
  TestTube2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getPredictionHistoryForCurrentUser, loadPredictionHistoryForCurrentUser, type PredictionHistoryEntry } from '../historyStore';
import { toast } from 'sonner';

const escapePdfText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const wrapPdfLines = (lines: string[], maxChars = 82) =>
  lines.flatMap((line) => {
    if (!line || line.length <= maxChars) {
      return [line];
    }

    const wrappedLines: string[] = [];
    let currentLine = '';

    line.split(/\s+/).forEach((word) => {
      const candidateLine = currentLine ? `${currentLine} ${word}` : word;
      if (candidateLine.length > maxChars && currentLine) {
        wrappedLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidateLine;
      }
    });

    if (currentLine) {
      wrappedLines.push(currentLine);
    }

    return wrappedLines;
  });

const createSimplePdf = (lines: string[]) => {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 54;
  const startY = 736;
  const lineHeight = 16;
  const maxLinesPerPage = Math.floor((startY - 72) / lineHeight);
  const chunks: string[][] = [];

  const wrappedLines = wrapPdfLines(lines);

  for (let index = 0; index < wrappedLines.length; index += maxLinesPerPage) {
    chunks.push(wrappedLines.slice(index, index + maxLinesPerPage));
  }

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const pageObjectIds = chunks.map((_, index) => 3 + index * 2);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${chunks.length} >>\nendobj\n`);

  chunks.forEach((chunk, pageIndex) => {
    const pageObjectId = 3 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    const streamLines = [
      'BT',
      '/F1 11 Tf',
      '14 TL',
      `${marginX} ${startY} Td`,
      ...chunk.flatMap((line, lineIndex) => {
        const escapedLine = escapePdfText(line);
        return lineIndex === 0
          ? [`(${escapedLine}) Tj`]
          : ['T*', `(${escapedLine}) Tj`];
      }),
      'ET',
    ];
    const stream = streamLines.join('\n');

    objects.push(`${pageObjectId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentObjectId} 0 R >>\nendobj\n`);
    objects.push(`${contentObjectId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += object;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
};

function sourceLabel(source: PredictionHistoryEntry['source']) {
  if (source === 'form') return 'Manual assessment';
  if (source === 'ml-invasive') return 'PSA / invasive model';
  return 'FTIR / non-invasive model';
}

function badgeClass(color: PredictionHistoryEntry['color']) {
  if (color === 'green') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200';
  if (color === 'yellow') return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200';
  return 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200';
}

function toPercent(value: number | null | undefined) {
  return typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : 'Not available';
}

export function Results() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<PredictionHistoryEntry[]>(() => getPredictionHistoryForCurrentUser());

  useEffect(() => {
    loadPredictionHistoryForCurrentUser()
      .then(setEntries)
      .catch(() => {
        // Fallback stays on local history when the API is unavailable.
      });
  }, []);

  const latestAssessment = entries[0] ?? null;
  const latestPsaResult = entries.find((entry) => entry.source === 'ml-invasive') ?? null;
  const latestFtirResult = entries.find((entry) => entry.source === 'ml-ftir') ?? null;
  const recentEntries = entries.slice(0, 8);
  const recentModelEntries = entries.filter((entry) => entry.source !== 'form').slice(0, 8);

  const modalityTrendData = useMemo(() => {
    return [...recentModelEntries]
      .reverse()
      .map((entry, index) => {
        const probability =
          typeof entry.predictionValue === 'number'
            ? Number((entry.predictionValue * 100).toFixed(2))
            : null;

        return {
          label: `${new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} #${index + 1}`,
          psa: entry.source === 'ml-invasive' ? probability : null,
          ftir: entry.source === 'ml-ftir' ? probability : null,
        };
      });
  }, [recentModelEntries]);

  const riskTrendData = useMemo(() => {
    return [...recentEntries]
      .reverse()
      .map((entry) => ({
        date: new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: entry.riskScore,
      }));
  }, [recentEntries]);

  const comparisonSummary = useMemo(() => {
    if (!latestPsaResult && !latestFtirResult) {
      return 'No PSA-based or FTIR-based model outputs have been saved yet.';
    }

    if (latestPsaResult && latestFtirResult) {
      const psaPercent = typeof latestPsaResult.predictionValue === 'number'
        ? latestPsaResult.predictionValue * 100
        : null;
      const ftirPercent = typeof latestFtirResult.predictionValue === 'number'
        ? latestFtirResult.predictionValue * 100
        : null;

      if (psaPercent !== null && ftirPercent !== null) {
        const delta = Math.abs(psaPercent - ftirPercent).toFixed(2);
        return `Latest saved PSA and FTIR model outputs are both available. Their displayed probabilities differ by ${delta} percentage points, so this page now keeps them visible as separate results rather than blending them together.`;
      }
    }

    if (latestPsaResult) {
      return 'You currently have a saved PSA / invasive model result. Run an FTIR assessment to compare both modalities on the same overview page.';
    }

    return 'You currently have a saved FTIR / non-invasive model result. Run a PSA-based assessment to compare both modalities on the same overview page.';
  }, [latestFtirResult, latestPsaResult]);

  const handleShare = () => {
    if (!latestAssessment) {
      toast.error('No assessment results available to share yet.');
      return;
    }

    const shareLines = [
      'ProstAPP Health Report',
      `Latest Risk Level: ${latestAssessment.riskLevel}`,
      `Latest Risk Score: ${latestAssessment.riskScore}/100`,
      `Latest Assessment: ${new Date(latestAssessment.createdAt).toLocaleDateString()}`,
      latestPsaResult ? `Latest PSA/Invasive Probability: ${toPercent(latestPsaResult.predictionValue)}` : 'Latest PSA/Invasive Probability: Not available',
      latestFtirResult ? `Latest FTIR Probability: ${toPercent(latestFtirResult.predictionValue)}` : 'Latest FTIR Probability: Not available',
    ];

    navigator.clipboard.writeText(shareLines.join('\n')).then(() => {
      toast.success('Health summary copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  const handleExportPDF = () => {
    if (!latestAssessment) {
      toast.error('No assessment results available to export yet.');
      return;
    }

    const reportLines = [
      'ProstAPP - Health Assessment Report',
      '',
      `Generated: ${new Date().toLocaleDateString()}`,
      '',
      'Latest Assessment',
      `Risk Level: ${latestAssessment.riskLevel}`,
      `Risk Score: ${latestAssessment.riskScore}/100`,
      `Latest Assessment Type: ${sourceLabel(latestAssessment.source)}`,
      '',
      'Latest Model Results',
      latestPsaResult ? `Latest PSA / Invasive Probability: ${toPercent(latestPsaResult.predictionValue)}` : 'Latest PSA / Invasive Probability: Not available',
      latestFtirResult ? `Latest FTIR / Non-Invasive Probability: ${toPercent(latestFtirResult.predictionValue)}` : 'Latest FTIR / Non-Invasive Probability: Not available',
      '',
      'Recent Assessment History',
      ...recentEntries.map((entry, index) => (
        `${index + 1}. ${new Date(entry.createdAt).toLocaleDateString()} - ${sourceLabel(entry.source)} - ${entry.riskLevel} Risk (${entry.riskScore}/100)`
      )),
      '',
      'This report is for informational purposes only.',
      'Please consult with your healthcare provider for medical advice.',
    ];

    const pdfContent = createSimplePdf(reportLines);
    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ProstAPP-Report-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Report exported successfully!');
  };

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card className="border-2 border-slate-200 dark:border-slate-800 dark:bg-slate-950">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-slate-100">Assessment Results</CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">No saved results are available yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/dashboard/risk-assessment')}>Run Your First Assessment</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-slate-100">Assessment Results</h1>
          <p className="text-slate-600 dark:text-slate-400">Track both PSA-based and FTIR-based outcomes from your saved assessments.</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleShare}
            className="border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button className="bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <Card className="border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cross-modality summary</p>
            <p className="max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">{comparisonSummary}</p>
          </div>
          <Badge variant="outline" className="w-fit border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
            {recentModelEntries.length} model result{recentModelEntries.length === 1 ? '' : 's'} tracked
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-l-4 border-l-emerald-500 dark:border-slate-800 dark:bg-slate-950">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Latest Overall Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-emerald-600">{latestAssessment?.riskLevel}</div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Score: {latestAssessment?.riskScore}/100</p>
              </div>
              <Activity className="h-10 w-10 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-sky-500 dark:border-slate-800 dark:bg-slate-950">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Latest PSA / Invasive Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-sky-600">
                  {latestPsaResult ? toPercent(latestPsaResult.predictionValue) : 'N/A'}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {latestPsaResult ? `${latestPsaResult.riskLevel} risk` : 'No PSA-based result yet'}
                </p>
              </div>
              <TestTube2 className="h-10 w-10 text-sky-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500 dark:border-slate-800 dark:bg-slate-950">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Latest FTIR Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                  {latestFtirResult ? toPercent(latestFtirResult.predictionValue) : 'N/A'}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {latestFtirResult ? `${latestFtirResult.riskLevel} risk` : 'No FTIR result yet'}
                </p>
              </div>
              <FileSpreadsheet className="h-10 w-10 text-violet-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="modalities" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-slate-100 dark:bg-slate-900">
          <TabsTrigger value="modalities">Modalities</TabsTrigger>
          <TabsTrigger value="risk">Risk History</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
        </TabsList>

        <TabsContent value="modalities">
          <Card className="dark:border-slate-800 dark:bg-slate-950">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-slate-100">Model Probability History</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">Recent PSA/invasive and FTIR/non-invasive model outputs shown as separate series.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={modalityTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      label={{ value: 'Probability (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                    />
                    <Tooltip formatter={(value: number | null) => value === null ? 'Not available' : `${value.toFixed(2)}%`} />
                    <Line
                      type="monotone"
                      dataKey="psa"
                      stroke="#0284c7"
                      strokeWidth={2}
                      name="PSA / invasive"
                      dot={{ fill: '#0284c7', r: 4 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="ftir"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      name="FTIR / non-invasive"
                      dot={{ fill: '#8b5cf6', r: 4 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/30 dark:bg-sky-500/10">
                <h4 className="mb-2 font-semibold text-sky-900 dark:text-sky-100">Reading this view</h4>
                <p className="text-sm text-sky-800 dark:text-sky-200">
                  PSA / invasive and FTIR / non-invasive results can coexist in your history. This chart now keeps them as separate traces so you can compare each modality without one result pretending to stand in for the other.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card className="dark:border-slate-800 dark:bg-slate-950">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-slate-100">Risk Score Trend</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">Recent risk scores across all saved assessments.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      label={{ value: 'Risk Score', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                    />
                    <Tooltip formatter={(value: number) => `${value}/100`} />
                    <Bar dataKey="score" fill="#22c55e" name="Risk score" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <h4 className="mb-2 font-semibold text-emerald-900 dark:text-emerald-100">Trend summary</h4>
                <p className="text-sm text-emerald-800 dark:text-emerald-200">
                  Risk scores shown here are presentation scores derived from each saved assessment result. Use them for tracking direction over time rather than as a standalone diagnosis.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments">
          <Card className="dark:border-slate-800 dark:bg-slate-950">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-slate-100">Assessment History</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">Saved assessments from manual, PSA-based, and FTIR-based workflows.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`
                        flex h-16 w-16 items-center justify-center rounded-full
                        ${entry.color === 'green' ? 'bg-green-100 dark:bg-green-500/15' : ''}
                        ${entry.color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-500/15' : ''}
                        ${entry.color === 'red' ? 'bg-red-100 dark:bg-red-500/15' : ''}
                      `}>
                        <span className={`
                          text-xl font-bold
                          ${entry.color === 'green' ? 'text-green-700 dark:text-green-300' : ''}
                          ${entry.color === 'yellow' ? 'text-yellow-700 dark:text-yellow-300' : ''}
                          ${entry.color === 'red' ? 'text-red-700 dark:text-red-300' : ''}
                        `}>
                          {entry.riskScore}
                        </span>
                      </div>
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className={badgeClass(entry.color)}>
                            {entry.riskLevel} Risk
                          </Badge>
                          <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-300">{sourceLabel(entry.source)}</Badge>
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {new Date(entry.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Risk score: {entry.riskScore}/100</p>
                        {typeof entry.predictionValue === 'number' && (
                          <p className="text-sm text-slate-600 dark:text-slate-300">Model probability: {toPercent(entry.predictionValue)}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                      onClick={() => navigate(`/dashboard/history-report?report=${entry.id}`)}
                    >
                      View Full Report
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
