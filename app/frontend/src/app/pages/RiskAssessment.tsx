import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileUp,
  HeartPulse,
  Loader,
  RotateCcw,
  TrendingUp,
} from 'lucide-react';
import { savePredictionHistoryEntry } from '../historyStore';
import { buildApiUrl } from '../lib/api';

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

const toProbability = (value: unknown) => {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const normalizedValue = numericValue > 1 && numericValue <= 100
    ? numericValue / 100
    : numericValue;

  return Math.min(Math.max(normalizedValue, 0), 1);
};

export function RiskAssessment() {
  const navigate = useNavigate();
  const invasiveExpectedHeaders = [
    'age',
    'psa_(ng/ml)',
    'body_weight_(kg)',
    'height_(cm)',
    'family_history_prostate_cancer',
    'educational_background',
    'hypertension',
    'heart_disease',
    'cerebro_vascular_disease',
    'hyperlipidemia',
    'diabetes_melitus',
    'renal_disease',
    'other_cancer',
    'other_disease',
    'region_Rural',
    'race_C',
    'race_I',
    'race_M',
  ];
  const ftirMinWavenumberCount = 2020;

  const [assessmentMode, setAssessmentMode] = useState<'form' | 'csv'>('form');
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvType, setCsvType] = useState<'invasive' | 'ftir' | null>(null);
  const [ftirModelType, setFtirModelType] = useState<'xgb' | 'lgbm'>('xgb');
  const [formData, setFormData] = useState({
    age: '',
    familyHistory: '',
    psa: '',
    symptoms: '',
    ethnicity: '',
    lifestyle: '',
  });

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;
  const stepTitles = ['Personal details', 'Medical history', 'Lifestyle'];
  const introPanelClass =
    'rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-black/25';
  const cardClass =
    'overflow-hidden rounded-[2rem] border-white/80 bg-white/90 shadow-2xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/25';
  const cardHeaderClass =
    'border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/55';
  const selectedOptionClass =
    'rounded-[1.35rem] border border-sky-500 bg-sky-50 px-4 py-3.5 text-left shadow-sm dark:border-sky-500/60 dark:bg-sky-950/45';
  const unselectedOptionClass =
    'rounded-[1.35rem] border border-slate-200 bg-white/80 px-4 py-3.5 text-left transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700 dark:hover:bg-slate-800/80';
  const inputClass =
    'h-12 rounded-2xl border-slate-200 bg-white shadow-sm focus-visible:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus-visible:ring-sky-900/40';
  const outlineButtonClass =
    'h-12 rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800';
  const primaryButtonClass =
    'h-12 rounded-2xl bg-slate-950 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100';
  const downloadButtonClass =
    'h-12 rounded-2xl border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/45 dark:text-sky-100 dark:hover:bg-sky-900/55';
  const invasivePredictButtonClass =
    'h-12 rounded-2xl border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/45 dark:text-sky-100 dark:hover:bg-sky-900/55';
  const ftirPredictButtonClass =
    'h-12 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/45 dark:text-emerald-100 dark:hover:bg-emerald-900/55';

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const calculateRisk = async () => {
    setLoading(true);
    try {
      // Map form data to the invasive model's expected CSV columns
      const age = parseFloat(formData.age) || 50;
      const psa = parseFloat(formData.psa) || 1.0;
      const familyHistory = formData.familyHistory === 'yes' ? 1 : 0;
      const hasSymptoms = formData.symptoms === 'yes' ? 1 : 0;

      // Build a CSV string matching invasive model headers
      const headers = invasiveExpectedHeaders.join(',');
      const raceC = formData.ethnicity === 'caucasian' ? 1 : 0;
      const raceI = formData.ethnicity === 'asian' ? 1 : 0;
      const raceM = formData.ethnicity === 'african' || formData.ethnicity === 'hispanic' ? 1 : 0;
      const regionRural = 0;
      const values = [
        age,          // age
        psa,          // psa_(ng/ml)
        75,           // body_weight_(kg) - default
        170,          // height_(cm) - default
        familyHistory,// family_history_prostate_cancer
        2,            // educational_background - default
        hasSymptoms,  // hypertension (proxy for symptoms)
        0, 0, 0, 0, 0, 0, 0, // heart_disease through other_disease - defaults
        regionRural, raceC, raceI, raceM,
      ].join(',');

      const csvContent = `${headers}\n${values}`;
      const csvBlob = new Blob([csvContent], { type: 'text/csv' });
      const csvFileObj = new File([csvBlob], 'manual_entry.csv', { type: 'text/csv' });

      const formDataToSend = new FormData();
      formDataToSend.append('file', csvFileObj);
      formDataToSend.append('modelType', 'xgb');

      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user?.email) formDataToSend.append('userEmail', user.email);
        } catch (e) {
          console.error('Could not parse user:', e);
        }
      }

      const predictEndpoint = buildApiUrl('/api/predict-invasive');
      const shapEndpoint = buildApiUrl('/api/shap-invasive');

      if (!predictEndpoint) {
        throw new Error('Prediction backend unavailable.');
      }

      const [predictResponse, shapResponse] = await Promise.all([
        fetch(predictEndpoint, { method: 'POST', body: formDataToSend }),
        shapEndpoint ? fetch(shapEndpoint, { method: 'POST', body: formDataToSend }).catch(() => null) : Promise.resolve(null),
      ]);

      if (!predictResponse.ok) throw new Error('Prediction failed');

      const data = await predictResponse.json();
      let shapData = null;
      if (shapResponse && shapResponse.ok) {
        try { shapData = await shapResponse.json(); } catch {} 
      }

      if (!data.success) throw new Error(data.error || 'Invalid response from server');

      const predictionClass = typeof data.prediction !== 'undefined' ? data.prediction : data.result;
      const predictionProbability = toProbability(data.probability) ?? toProbability(data.prediction_probability) ?? toProbability(data.risk_probability) ?? toProbability(predictionClass);

      if (predictionProbability === null) throw new Error('Prediction probability missing from server response');

      const riskScore = Math.round(predictionProbability * 100);
      let riskLevel = 'Low';
      let riskColor = 'green';
      if (riskScore >= 60) { riskLevel = 'High'; riskColor = 'red'; }
      else if (riskScore >= 30) { riskLevel = 'Moderate'; riskColor = 'yellow'; }

      const newResult = {
        score: riskScore,
        level: riskLevel,
        color: riskColor,
        date: new Date().toLocaleDateString(),
        csvBased: true,
        csvType: 'invasive' as const,
        predictionValue: predictionProbability,
        predictionClass,
        csvFileName: 'Manual entry (PSA model)',
        limeSummary: data.lime_summary || null,
        shapSummary: shapData?.shap_summary || data.shap_summary || null,
        topLimeFeatures: data?.lime?.top_features || [],
        topShapFeatures: shapData?.global_importance || data?.shap?.global_importance || [],
        featureNotes: data?.lime_feature_notes || [],
      };

      setResult(newResult);
      saveAssessmentResult(newResult);
      toast.success('PSA model prediction completed!');
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const saveAssessmentResult = (result: any) => {
    try {
      const existingHistory = localStorage.getItem('assessmentHistory');
      const history = existingHistory ? JSON.parse(existingHistory) : [];
      
      const newAssessment = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        riskLevel: result.level,
        riskScore: result.score,
        color: result.color,
      };

      history.unshift(newAssessment);
      // Keep only last 10 assessments
      localStorage.setItem('assessmentHistory', JSON.stringify(history.slice(0, 10)));

      savePredictionHistoryEntry({
        source: result.csvBased ? (result.csvType === 'ftir' ? 'ml-ftir' : 'ml-invasive') : 'form',
        riskLevel: result.level,
        riskScore: result.score,
        color: result.color,
        predictionValue: result.predictionValue ?? null,
        predictionClass: result.predictionClass ?? null,
        csvType: result.csvType ?? null,
        csvFileName: result.csvFileName ?? null,
        limeSummary: result.limeSummary ?? null,
        shapSummary: result.shapSummary ?? null,
        topLimeFeatures: result.topLimeFeatures ?? [],
        topShapFeatures: result.topShapFeatures ?? [],
        featureNotes: result.featureNotes ?? [],
      });
    } catch (error) {
      console.error('Error saving assessment:', error);
    }
  };

  const handleSubmit = async () => {
    await calculateRisk();
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setCsvFile(file);
  };

  const validateCsvByType = async (file: File, type: 'invasive' | 'ftir') => {
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      return {
        valid: false,
        message: 'CSV must include a header row and at least one data row.',
      };
    }

    const header = lines[0].split(',').map((cell) => cell.trim());
    const firstDataRow = lines[1].split(',').map((cell) => cell.trim());

    if (type === 'invasive') {
      const sameLength = header.length === invasiveExpectedHeaders.length;
      const sameHeaders =
        sameLength &&
        header.every((name, idx) => name === invasiveExpectedHeaders[idx]);

      if (!sameHeaders) {
        return {
          valid: false,
          message:
            'Uploaded CSV does not match Invasive/PSA format. Please upload a file with the required invasive headers.',
        };
      }

      if (firstDataRow.length !== invasiveExpectedHeaders.length) {
        return {
          valid: false,
          message:
            'Invasive/PSA CSV data row has incorrect number of columns.',
        };
      }
    }

    if (type === 'ftir') {
      // Count wavenumber columns (numeric headers in 400-4000 range)
      const wavenumberCols = header.filter(h => {
        const n = Number(h);
        return !isNaN(n) && n >= 400 && n <= 4000;
      });

      if (wavenumberCols.length < ftirMinWavenumberCount) {
        return {
          valid: false,
          message: `Uploaded CSV does not match raw FTIR format. Expected at least ${ftirMinWavenumberCount} wavenumber columns (400–4000), but found ${wavenumberCols.length}. Please upload raw FTIR spectral data.`,
        };
      }
    }

    return { valid: true, message: '' };
  };

  const handleCsvTypeSelect = async (type: 'invasive' | 'ftir') => {
    if (!csvFile) {
      toast.error('Please select a CSV file first');
      return;
    }

    setCsvType(type);
    setLoading(true);
    try {
      const validation = await validateCsvByType(csvFile, type);
      if (!validation.valid) {
        toast.error(validation.message);
        return;
      }

      const formDataToSend = new FormData();
      formDataToSend.append('file', csvFile);
      formDataToSend.append('modelType', type === 'ftir' ? ftirModelType : 'xgb');

      // Get user email from localStorage and add to form data
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user?.email) {
            formDataToSend.append('userEmail', user.email);
          }
        } catch (e) {
          console.error('Could not parse user from localStorage:', e);
        }
      }

      const predictEndpoint = type === 'invasive'
        ? buildApiUrl('/api/predict-invasive')
        : buildApiUrl('/api/predict-ftir');

      const shapEndpoint = type === 'invasive'
        ? buildApiUrl('/api/shap-invasive')
        : buildApiUrl('/api/shap-ftir');

      if (!predictEndpoint || !shapEndpoint) {
        throw new Error('Prediction backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
      }

      // Fetch LIME/Predict and SHAP streams in parallel
      const [predictResponse, shapResponse] = await Promise.all([
        fetch(predictEndpoint, { method: 'POST', body: formDataToSend }),
        fetch(shapEndpoint, { method: 'POST', body: formDataToSend }).catch(() => null)
      ]);

      if (!predictResponse.ok) {
        throw new Error('Prediction failed');
      }

      const data = await predictResponse.json();

      let shapData = null;
      if (shapResponse && shapResponse.ok) {
        try {
          shapData = await shapResponse.json();
        } catch (e) {
          console.error("Failed to parse SHAP response", e);
        }
      }
      
      // Determine risk level based on response
      let riskLevel = 'Low';
      let riskColor = 'green';
      
      if (data.success) {
        const predictionClass = typeof data.prediction !== 'undefined' ? data.prediction : data.result;
        const predictionProbability = toProbability(data.probability) ?? toProbability(data.prediction_probability) ?? toProbability(data.risk_probability) ?? toProbability(predictionClass);
        if (predictionProbability === null) {
          throw new Error('Prediction probability missing from server response');
        }
        
        // Map probability to risk score (0-100 scale). data.prediction is a class label, not the probability.
        const riskScore = Math.round(predictionProbability * 100);
        
        if (riskScore >= 60) {
          riskLevel = 'High';
          riskColor = 'red';
        } else if (riskScore >= 30) {
          riskLevel = 'Moderate';
          riskColor = 'yellow';
        }

        setResult({
          score: riskScore,
          level: riskLevel,
          color: riskColor,
          date: new Date().toLocaleDateString(),
          csvBased: true,
          predictionValue: predictionProbability,
          predictionClass,
          csvType: type,
          limeSummary: data.lime_summary || null,
          shapSummary: shapData?.shap_summary || data.shap_summary || null,
        });

        localStorage.setItem('latestModelInsight', JSON.stringify({
          timestamp: new Date().toISOString(),
          csvType: type,
          predictionValue: predictionProbability,
          predictionClass,
          riskScore,
          riskLevel,
          limeSummary: data.lime_summary || null,
          shapSummary: shapData?.shap_summary || data.shap_summary || null,
          topLimeFeatures: data?.lime?.top_features || [],
          topShapFeatures: shapData?.global_importance || data?.shap?.global_importance || [],
          featureNotes: data?.lime_feature_notes || [],
        }));

        // Save to localStorage for Results page
        saveAssessmentResult({
          score: riskScore,
          level: riskLevel,
          color: riskColor,
          csvBased: true,
          csvType: type,
          predictionValue: predictionProbability,
          predictionClass,
          csvFileName: csvFile.name,
          limeSummary: data.lime_summary || null,
          shapSummary: shapData?.shap_summary || data.shap_summary || null,
          topLimeFeatures: data?.lime?.top_features || [],
          topShapFeatures: shapData?.global_importance || data?.shap?.global_importance || [],
          featureNotes: data?.lime_feature_notes || [],
        });

        toast.success('File-upload prediction completed successfully!');
      } else {
        throw new Error(data.error || 'Invalid response from server');
      }
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = (assessmentResult: any) => {
    const generatedDate = new Date().toLocaleDateString();
    const reportLines = [
      'ProstAPP - Risk Assessment Report',
      '',
      `Generated: ${generatedDate}`,
      `Assessment Date: ${assessmentResult.date || generatedDate}`,
      `Assessment Method: ${assessmentResult.csvBased ? 'File-upload format' : 'Manual entry'}`,
      '',
      'Assessment Result',
      `Risk Level: ${assessmentResult.level} Risk`,
      `Risk Score: ${assessmentResult.score}/100`,
      ...(assessmentResult.csvBased
        ? [
            `Model Probability: ${(assessmentResult.predictionValue * 100).toFixed(2)}%`,
            `Model Type: ${assessmentResult.csvType === 'ftir' ? 'FTIR / non-invasive' : 'PSA / invasive'}`,
            assessmentResult.csvFileName ? `Uploaded File: ${assessmentResult.csvFileName}` : '',
          ].filter(Boolean)
        : [
            `Age: ${formData.age || 'Not provided'}`,
            `Family History: ${formData.familyHistory || 'Not provided'}`,
            `PSA Level: ${formData.psa || 'Not provided'}`,
            `Symptoms: ${formData.symptoms || 'Not provided'}`,
          ]),
      '',
      'Recommended Next Steps',
      'Review this report with a healthcare professional.',
      'Continue appropriate screening and follow-up based on clinical advice.',
      '',
      'Important Notice',
      'This assessment is for informational purposes only and does not replace professional medical advice, diagnosis, or treatment.',
    ];

    const pdfContent = createSimplePdf(reportLines);
    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ProstAPP-Risk-Report-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Report downloaded successfully!');
  };

  if (result) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className={introPanelClass}>
          <div className="mb-2 flex items-center gap-3 text-sm font-medium text-sky-700 dark:text-sky-300">
            <TrendingUp className="h-5 w-5" />
            Assessment complete
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white">Assessment results</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Your prostate cancer risk assessment has been completed using {result.csvBased ? 'file-upload format' : 'manual entry'}.
          </p>
        </div>

        <Card className={cardClass}>
          <CardHeader className={cardHeaderClass}>
            <CardTitle className="flex items-center gap-3 text-slate-950 dark:text-white">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300">
                <TrendingUp className="h-6 w-6" />
              </span>
              Risk analysis
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Based on {result.csvBased ? 'the uploaded file and selected model' : 'the information you entered manually'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-8">
              <div className={`
                inline-flex items-center justify-center h-36 w-36 rounded-full mb-4 shadow-inner
                ${result.color === 'green' ? 'bg-emerald-50 ring-8 ring-emerald-100/80 dark:bg-emerald-950/50 dark:ring-emerald-900/50' : ''}
                ${result.color === 'yellow' ? 'bg-amber-50 ring-8 ring-amber-100/80 dark:bg-amber-950/50 dark:ring-amber-900/50' : ''}
                ${result.color === 'red' ? 'bg-rose-50 ring-8 ring-rose-100/80 dark:bg-rose-950/50 dark:ring-rose-900/50' : ''}
              `}>
                <span className={`
                  text-5xl font-semibold
                  ${result.color === 'green' ? 'text-emerald-700 dark:text-emerald-300' : ''}
                  ${result.color === 'yellow' ? 'text-amber-700 dark:text-amber-300' : ''}
                  ${result.color === 'red' ? 'text-rose-700 dark:text-rose-300' : ''}
                `}>
                  {result.score}
                </span>
              </div>
              <h3 className="text-2xl font-semibold text-slate-950 mb-2 dark:text-white">
                {result.level} Risk
              </h3>
              <p className="text-slate-600 dark:text-slate-300">Risk score: {result.score} / 100</p>
              {result.csvBased && (
                <p className="text-xs font-medium text-sky-700 mt-2 dark:text-sky-300">File-upload prediction: {(result.predictionValue * 100).toFixed(2)}%</p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-3xl border border-sky-100 bg-sky-50/80 p-5 dark:border-sky-900/60 dark:bg-sky-950/35">
                <h4 className="font-semibold text-sky-950 mb-3 dark:text-sky-100">Recommendations</h4>
                <ul className="space-y-3 text-sm text-sky-900 dark:text-sky-200">
                  {result.level === 'High' && (
                    <>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        Schedule an appointment with a urologist immediately
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        Consider additional screening tests (DRE, biopsy)
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        Monitor PSA levels closely
                      </li>
                    </>
                  )}
                  {result.level === 'Moderate' && (
                    <>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        Consult with your healthcare provider
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        Get regular PSA screenings
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        Maintain a healthy lifestyle
                      </li>
                    </>
                  )}
                  {result.level === 'Low' && (
                    <>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        Continue regular health checkups
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        Maintain healthy diet and exercise
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        Schedule annual PSA screening after age 50
                      </li>
                    </>
                  )}
                </ul>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/65">
                <h4 className="font-semibold text-slate-950 mb-3 dark:text-white">Next steps</h4>
                <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    Review educational resources
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    Download your results report
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    Schedule a follow-up appointment
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 flex gap-3 dark:border-amber-900/60 dark:bg-amber-950/35">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5 dark:text-amber-300" />
              <div className="text-sm text-amber-800 dark:text-amber-100">
                <p className="font-semibold mb-1">Important Notice</p>
                <p>
                  This assessment is for informational purposes only and does not replace professional 
                  medical advice. Please consult with a healthcare provider for proper diagnosis and treatment.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => {
                setResult(null);
                setStep(1);
                setAssessmentMode('form');
                setCsvFile(null);
                setCsvType(null);
                setFormData({ age: '', familyHistory: '', psa: '', symptoms: '', ethnicity: '', lifestyle: '' });
              }} variant="outline" className={`${outlineButtonClass} flex-1`}>
                <RotateCcw className="h-4 w-4" />
                Start a new assessment
              </Button>
              <Button onClick={() => handleDownloadReport(result)} variant="outline" className={`${downloadButtonClass} flex-1`}>
                <Download className="h-4 w-4" />
                Download report
              </Button>
            </div>

            {result.csvBased && (result.limeSummary || result.shapSummary) && (
              <Button
                variant="secondary"
                className="h-12 w-full rounded-2xl"
                onClick={() => navigate('/dashboard/history-report')}
              >
                View full report
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (assessmentMode === 'csv') {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className={introPanelClass}>
          <div className="mb-2 flex items-center gap-3 text-sm font-medium text-sky-700 dark:text-sky-300">
            <FileUp className="h-5 w-5" />
            File-upload format
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white">Upload assessment data</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Upload a supported CSV file to run a model-based risk prediction.</p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setAssessmentMode('form');
              setCsvFile(null);
            }}
            className={unselectedOptionClass}
          >
            <ClipboardList className="mb-4 h-6 w-6 text-slate-500 dark:text-slate-400" />
            <span className="block font-semibold text-slate-900 dark:text-slate-100">Manual entry</span>
            <span className="mt-1 block text-sm leading-6 text-slate-500 dark:text-slate-400">Type answers step by step.</span>
          </button>
          <button
            type="button"
            className={selectedOptionClass}
          >
            <FileSpreadsheet className="mb-4 h-6 w-6 text-sky-700 dark:text-sky-300" />
            <span className="block font-semibold text-sky-950 dark:text-sky-100">File-upload format</span>
            <span className="mt-1 block text-sm leading-6 text-sky-800 dark:text-sky-200">Use invasive or FTIR CSV data.</span>
          </button>
        </div>

        <Card className={cardClass}>
          <CardHeader className={cardHeaderClass}>
            <CardTitle className="text-slate-950 dark:text-white">Upload patient data file</CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">Choose a CSV format, then run the matching prediction model</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-[1.75rem] border-2 border-dashed border-slate-200 bg-slate-50/80 p-8 text-center dark:border-slate-700 dark:bg-slate-950/60">
              {!csvFile ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="rounded-3xl bg-white p-4 text-sky-700 shadow-sm dark:bg-slate-900 dark:text-sky-300">
                    <FileUp className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-lg mb-2 font-semibold text-slate-950 dark:text-white">Select a CSV file</p>
                    <p className="text-sm text-slate-500 mb-4 dark:text-slate-400">Choose invasive or non-invasive data format</p>
                  </div>
                  <div className="flex flex-col gap-3 w-full max-w-sm">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleCsvUpload}
                        className="hidden"
                      />
                      <Button className={`${primaryButtonClass} w-full`} asChild>
                        <span>Select File</span>
                      </Button>
                    </label>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                    id="csv-input"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-3xl bg-white p-4 shadow-sm dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      <FileSpreadsheet className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-slate-950 dark:text-white">{csvFile.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{(csvFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCsvFile(null)}
                  >
                    ✕
                  </Button>
                </div>
              )}
            </div>

            {csvFile && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>FTIR model type</Label>
                  <Select value={ftirModelType} onValueChange={(v) => setFtirModelType(v as 'xgb' | 'lgbm')}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xgb">XGBoost (XGB)</SelectItem>
                      <SelectItem value="lgbm">LightGBM (LGBM)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Select which model to use for FTIR file-upload prediction</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    onClick={() => handleCsvTypeSelect('invasive')}
                    disabled={loading}
                    variant="outline"
                    className={invasivePredictButtonClass}
                  >
                    {loading ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Predict (PSA/Invasive)
                  </Button>
                  <Button
                    onClick={() => handleCsvTypeSelect('ftir')}
                    disabled={loading}
                    variant="outline"
                    className={ftirPredictButtonClass}
                  >
                    {loading ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Predict (FTIR/Non-Invasive)
                  </Button>
                </div>
              </div>
            )}

            <Button
              onClick={() => {
                setAssessmentMode('form');
                setCsvFile(null);
              }}
              variant="outline"
              className={`${outlineButtonClass} w-full`}
            >
              Back to manual entry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className={introPanelClass}>
        <div className="mb-2 flex items-center gap-3 text-sm font-medium text-sky-700 dark:text-sky-300">
          <HeartPulse className="h-5 w-5" />
          Risk assessment
        </div>
        <h1 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white">How would you like to provide data?</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Use manual entry for quick answers, or upload a CSV file when clinical data is already prepared.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setAssessmentMode('form')}
          className={selectedOptionClass}
        >
          <ClipboardList className="mb-4 h-6 w-6 text-sky-700 dark:text-sky-300" />
          <span className="block font-semibold text-sky-950 dark:text-sky-100">Manual entry</span>
          <span className="mt-1 block text-sm leading-6 text-sky-800 dark:text-sky-200">Answer a few guided questions.</span>
        </button>
        <button
          type="button"
          onClick={() => setAssessmentMode('csv')}
          className={unselectedOptionClass}
        >
          <FileSpreadsheet className="mb-4 h-6 w-6 text-slate-500 dark:text-slate-400" />
          <span className="block font-semibold text-slate-900 dark:text-slate-100">File-upload format</span>
          <span className="mt-1 block text-sm leading-6 text-slate-500 dark:text-slate-400">Run prediction from a CSV file.</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-lg shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/75 dark:shadow-black/20">
        <div className="mb-3 flex justify-between text-sm text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-900 dark:text-slate-100">Step {step} of {totalSteps}: {stepTitles[step - 1]}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2 rounded-full" />
      </div>

      <Card className={cardClass}>
        <CardHeader className={cardHeaderClass}>
          <CardTitle className="text-slate-950 dark:text-white">
            {step === 1 && 'Personal details'}
            {step === 2 && 'Medical history'}
            {step === 3 && 'Lifestyle factors'}
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            {step === 1 && 'Start with basic demographic information.'}
            {step === 2 && 'Share relevant history and symptoms.'}
            {step === 3 && 'Add lifestyle context before calculating risk.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {/* Step 1: Personal Information */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="age">Age *</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="Enter your age"
                  value={formData.age}
                  onChange={(e) => handleChange('age', e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Ethnicity</Label>
                <Select value={formData.ethnicity} onValueChange={(value) => handleChange('ethnicity', value)}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Select your ethnicity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caucasian">Caucasian</SelectItem>
                    <SelectItem value="african">African American</SelectItem>
                    <SelectItem value="hispanic">Hispanic</SelectItem>
                    <SelectItem value="asian">Asian</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Step 2: Medical History */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Family History of Prostate Cancer</Label>
                <RadioGroup value={formData.familyHistory} onValueChange={(value) => handleChange('familyHistory', value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="family-yes" />
                    <Label htmlFor="family-yes" className="font-normal">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="family-no" />
                    <Label htmlFor="family-no" className="font-normal">No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="unknown" id="family-unknown" />
                    <Label htmlFor="family-unknown" className="font-normal">Don't Know</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="psa">PSA Level (ng/mL)</Label>
                <Input
                  id="psa"
                  type="number"
                  step="0.1"
                  placeholder="Enter your most recent PSA level"
                  value={formData.psa}
                  onChange={(e) => handleChange('psa', e.target.value)}
                  className={inputClass}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Normal range is typically 0-4 ng/mL</p>
              </div>

              <div className="space-y-2">
                <Label>Do you experience any urinary symptoms?</Label>
                <RadioGroup value={formData.symptoms} onValueChange={(value) => handleChange('symptoms', value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="symptoms-yes" />
                    <Label htmlFor="symptoms-yes" className="font-normal">Yes (difficulty urinating, frequent urination, etc.)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="symptoms-no" />
                    <Label htmlFor="symptoms-no" className="font-normal">No</Label>
                  </div>
                </RadioGroup>
              </div>
            </>
          )}

          {/* Step 3: Lifestyle */}
          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label>Overall Lifestyle</Label>
                <RadioGroup value={formData.lifestyle} onValueChange={(value) => handleChange('lifestyle', value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="active" id="lifestyle-active" />
                    <Label htmlFor="lifestyle-active" className="font-normal">Active (regular exercise, healthy diet)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="moderate" id="lifestyle-moderate" />
                    <Label htmlFor="lifestyle-moderate" className="font-normal">Moderate</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sedentary" id="lifestyle-sedentary" />
                    <Label htmlFor="lifestyle-sedentary" className="font-normal">Sedentary (limited physical activity)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="rounded-3xl border border-sky-100 bg-sky-50/80 p-4 dark:border-sky-900/60 dark:bg-sky-950/35">
                <h4 className="font-semibold text-sky-950 mb-2 dark:text-sky-100">Ready to submit</h4>
                <p className="text-sm text-sky-800 dark:text-sky-200">
                  Review your answers and click "Calculate risk" to see your assessment results.
                </p>
              </div>
            </>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col gap-3 pt-4 sm:flex-row">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} className={`${outlineButtonClass} flex-1`}>
                Back
              </Button>
            )}
            {step < totalSteps ? (
              <Button onClick={handleNext} className={`${primaryButtonClass} flex-1`}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading} className={`${primaryButtonClass} flex-1`}>
                {loading ? <><Loader className="h-4 w-4 mr-2 animate-spin" /> Running PSA model...</> : 'Calculate risk (PSA model)'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
