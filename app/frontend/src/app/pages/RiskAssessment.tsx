import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, TrendingUp, Loader } from 'lucide-react';

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

  const calculateRisk = () => {
    // Simplified risk calculation for demo
    let riskScore = 0;
    
    // Age factor
    const age = parseInt(formData.age);
    if (age >= 70) riskScore += 30;
    else if (age >= 60) riskScore += 20;
    else if (age >= 50) riskScore += 10;

    // Family history
    if (formData.familyHistory === 'yes') riskScore += 25;

    // PSA level
    const psa = parseFloat(formData.psa);
    if (psa > 10) riskScore += 30;
    else if (psa > 4) riskScore += 20;
    else if (psa > 2.5) riskScore += 10;

    // Symptoms
    if (formData.symptoms === 'yes') riskScore += 15;

    // Determine risk level
    let riskLevel = 'Low';
    let riskColor = 'green';
    if (riskScore >= 60) {
      riskLevel = 'High';
      riskColor = 'red';
    } else if (riskScore >= 30) {
      riskLevel = 'Moderate';
      riskColor = 'yellow';
    }

    const newResult = {
      score: riskScore,
      level: riskLevel,
      color: riskColor,
      date: new Date().toLocaleDateString(),
      csvBased: false,
    };

    setResult(newResult);

    // Save to localStorage for Results page
    saveAssessmentResult(newResult);
    
    toast.success('Risk assessment completed!');
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
    } catch (error) {
      console.error('Error saving assessment:', error);
    }
  };

  const handleSubmit = () => {
    calculateRisk();
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

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888';

      const predictEndpoint = type === 'invasive' 
        ? `${API_BASE_URL}/api/predict-invasive`
        : `${API_BASE_URL}/api/predict-ftir`;

      const shapEndpoint = type === 'invasive'
        ? `${API_BASE_URL}/api/shap-invasive`
        : `${API_BASE_URL}/api/shap-ftir`;

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
        const prediction = typeof data.prediction !== 'undefined' ? data.prediction : data.result;
        if (typeof prediction === 'undefined' || prediction === null) {
          throw new Error('Prediction value missing from server response');
        }
        
        // Map prediction to risk score (0-100 scale)
        const riskScore = Math.round((prediction * 100)) || 0;
        
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
          predictionValue: prediction,
          csvType: type,
          limeSummary: data.lime_summary || null,
          shapSummary: shapData?.shap_summary || data.shap_summary || null,
        });

        localStorage.setItem('latestModelInsight', JSON.stringify({
          timestamp: new Date().toISOString(),
          csvType: type,
          predictionValue: prediction,
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
        });

        toast.success('ML prediction completed successfully!');
      } else {
        throw new Error(data.error || 'Invalid response from server');
      }
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Assessment Results</h1>
          <p className="text-gray-600">Your prostate cancer risk assessment has been completed{result.csvBased ? ' (ML Model)' : ' (Form-Based)'}</p>
        </div>

        <Card className="border-2 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-blue-600" />
              Risk Analysis
            </CardTitle>
            <CardDescription>Based on {result.csvBased ? 'machine learning prediction' : 'the information you provided'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-8">
              <div className={`
                inline-flex items-center justify-center w-32 h-32 rounded-full mb-4
                ${result.color === 'green' ? 'bg-green-100' : ''}
                ${result.color === 'yellow' ? 'bg-yellow-100' : ''}
                ${result.color === 'red' ? 'bg-red-100' : ''}
              `}>
                <span className={`
                  text-4xl font-bold
                  ${result.color === 'green' ? 'text-green-700' : ''}
                  ${result.color === 'yellow' ? 'text-yellow-700' : ''}
                  ${result.color === 'red' ? 'text-red-700' : ''}
                `}>
                  {result.score}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {result.level} Risk
              </h3>
              <p className="text-gray-600">Risk Score: {result.score} / 100</p>
              {result.csvBased && (
                <p className="text-xs text-blue-600 mt-2">ML Prediction: {(result.predictionValue * 100).toFixed(2)}%</p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Recommendations</h4>
                <ul className="space-y-2 text-sm text-blue-800">
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

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Next Steps</h4>
                <ul className="space-y-2 text-sm text-gray-700">
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

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">Important Notice</p>
                <p>
                  This assessment is for informational purposes only and does not replace professional 
                  medical advice. Please consult with a healthcare provider for proper diagnosis and treatment.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={() => setResult(null)} variant="outline" className="flex-1">
                Take New Assessment
              </Button>
              <Button className="flex-1">Download Report</Button>
            </div>

            {result.csvBased && (result.limeSummary || result.shapSummary) && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => navigate('/dashboard/groq-answers')}
              >
                View Groq Model Answers
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (assessmentMode === 'csv') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ML-Based Risk Assessment</h1>
          <p className="text-gray-600">Upload your medical data CSV file for machine learning prediction</p>
        </div>

        <Card className="border-2 mb-6">
          <CardHeader>
            <CardTitle>Upload Medical Data</CardTitle>
            <CardDescription>CSV file with patient medical features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-2 border-dashed rounded-lg p-8 text-center border-gray-300 bg-gray-50">
              {!csvFile ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-blue-100 rounded-full">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg mb-2 font-medium">Select a CSV file</p>
                    <p className="text-sm text-gray-500 mb-4">Choose invasive or non-invasive data format</p>
                  </div>
                  <div className="flex flex-col gap-3 w-full max-w-sm">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleCsvUpload}
                        className="hidden"
                      />
                      <Button className="w-full" asChild>
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
                <div className="flex items-center justify-between bg-white p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded">
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8 16.5a.5.5 0 01-.5-.5v-5H5.707a.5.5 0 01-.354-.854l5-5a.5.5 0 01.708 0l5 5a.5.5 0 01-.354.854H12.5V16a.5.5 0 01-1 0v-4.5H8.5V16a.5.5 0 01-.5.5z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{csvFile.name}</p>
                      <p className="text-sm text-gray-500">{(csvFile.size / 1024).toFixed(2)} KB</p>
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
                  <Label>FTIR Model Type</Label>
                  <Select value={ftirModelType} onValueChange={(v) => setFtirModelType(v as 'xgb' | 'lgbm')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xgb">XGBoost (XGB)</SelectItem>
                      <SelectItem value="lgbm">LightGBM (LGBM)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">Select which ML model to use for FTIR prediction</p>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => handleCsvTypeSelect('invasive')}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Predict (PSA/Invasive)
                  </Button>
                  <Button
                    onClick={() => handleCsvTypeSelect('ftir')}
                    disabled={loading}
                    variant="secondary"
                    className="flex-1"
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
              className="w-full"
            >
              Back to Form-Based Assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Prostate Cancer Risk Assessment</h1>
        <p className="text-gray-600">Choose your assessment method below</p>
      </div>

      {/* Assessment Mode Tabs */}
      <Tabs value={assessmentMode} onValueChange={(val) => setAssessmentMode(val as 'form' | 'csv')} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="form">Form-Based Assessment</TabsTrigger>
          <TabsTrigger value="csv">ML Model Upload</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Step {step} of {totalSteps}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>
            {step === 1 && 'Personal Information'}
            {step === 2 && 'Medical History'}
            {step === 3 && 'Lifestyle Factors'}
          </CardTitle>
          <CardDescription>
            {step === 1 && 'Provide your basic demographic information'}
            {step === 2 && 'Share your medical history and symptoms'}
            {step === 3 && 'Tell us about your lifestyle and habits'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Ethnicity</Label>
                <Select value={formData.ethnicity} onValueChange={(value) => handleChange('ethnicity', value)}>
                  <SelectTrigger>
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
                />
                <p className="text-xs text-gray-500">Normal range is typically 0-4 ng/mL</p>
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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Ready to Submit</h4>
                <p className="text-sm text-blue-800">
                  Review your answers and click "Calculate Risk" to see your assessment results.
                </p>
              </div>
            </>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 pt-4">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
            )}
            {step < totalSteps ? (
              <Button onClick={handleNext} className="flex-1">
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="flex-1">
                Calculate Risk
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
