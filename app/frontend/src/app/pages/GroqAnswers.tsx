import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Brain, Sparkles, AlertCircle, ArrowLeft, FileText } from 'lucide-react';

type ModelInsight = {
  timestamp: string;
  csvType: 'invasive' | 'ftir' | null;
  predictionValue: number;
  riskScore: number;
  riskLevel: string;
  limeSummary: string | null;
  shapSummary: string | null;
  topLimeFeatures: Array<{ feature: string; weight: number }>;
  topShapFeatures: Array<{ feature: string; mean_abs_shap: number; mean_shap?: number }>;
  featureNotes: Array<{ feature: string; value: number; meaning?: string }>;
};

export function GroqAnswers() {
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

  if (!insight) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Groq Model Answers</h1>
          <p className="text-gray-600">No Groq output is available yet.</p>
        </div>

        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-700 mt-0.5" />
            <div>
              <p className="text-sm text-amber-900">
                Run a CSV-based ML assessment first. Once a prediction returns a Groq-generated summary,
                it will appear on this page.
              </p>
              <div className="mt-4">
                <Link to="/dashboard/risk-assessment">
                  <Button>Go to Risk Assessment</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatListValue = (value: number | undefined) =>
    typeof value === 'number' ? value.toFixed(4) : 'N/A';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Groq Model Answers</h1>
          <p className="text-gray-600">LLM summaries generated from your most recent XAI prediction.</p>
        </div>
        <Link to="/dashboard/risk-assessment">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assessment
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Model Input</CardDescription>
            <CardTitle className="text-lg">{insight.csvType === 'invasive' ? 'PSA/Invasive CSV' : 'FTIR/Non-Invasive CSV'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Predicted Probability</CardDescription>
            <CardTitle className="text-lg">{(insight.predictionValue * 100).toFixed(2)}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Risk Level</CardDescription>
            <CardTitle className="text-lg flex items-center gap-2">
              {insight.riskLevel}
              <Badge variant="secondary">Score {insight.riskScore}/100</Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            LIME Summary (Groq)
          </CardTitle>
          <CardDescription>Patient-friendly explanation generated from local feature contributions.</CardDescription>
        </CardHeader>
        <CardContent>
          {insight.limeSummary ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{insight.limeSummary}</p>
          ) : (
            <p className="text-sm text-gray-500">No LIME summary returned for this prediction.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            SHAP Summary (Groq)
          </CardTitle>
          <CardDescription>Global feature-importance summary when available.</CardDescription>
        </CardHeader>
        <CardContent>
          {insight.shapSummary ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{insight.shapSummary}</p>
          ) : (
            <p className="text-sm text-gray-500">No SHAP summary returned for this prediction.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top LIME Features</CardTitle>
            <CardDescription>Most influential local features from the latest prediction.</CardDescription>
          </CardHeader>
          <CardContent>
            {insight.topLimeFeatures?.length ? (
              <div className="space-y-2">
                {insight.topLimeFeatures.slice(0, 8).map((f, idx) => (
                  <div key={`${f.feature}-${idx}`} className="flex items-center justify-between text-sm border-b pb-2">
                    <span className="font-medium text-gray-700">{f.feature}</span>
                    <span className="text-gray-500">{formatListValue(f.weight)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No LIME features found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top SHAP Features</CardTitle>
            <CardDescription>Global importance features returned by the backend.</CardDescription>
          </CardHeader>
          <CardContent>
            {insight.topShapFeatures?.length ? (
              <div className="space-y-2">
                {insight.topShapFeatures.slice(0, 8).map((f, idx) => (
                  <div key={`${f.feature}-${idx}`} className="flex items-center justify-between text-sm border-b pb-2">
                    <span className="font-medium text-gray-700">{f.feature}</span>
                    <span className="text-gray-500">{formatListValue(f.mean_abs_shap)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No SHAP features found.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Feature Notes
          </CardTitle>
          <CardDescription>Backend-generated feature notes used in explainability prompts.</CardDescription>
        </CardHeader>
        <CardContent>
          {insight.featureNotes?.length ? (
            <div className="space-y-2">
              {insight.featureNotes.slice(0, 10).map((note, idx) => (
                <div key={`${note.feature}-${idx}`} className="rounded-md border p-3">
                  <p className="text-sm font-medium text-gray-800">{note.feature}</p>
                  <p className="text-xs text-gray-500">Value: {formatListValue(note.value)}</p>
                  {note.meaning ? <p className="text-sm text-gray-700 mt-1">{note.meaning}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No feature notes found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
