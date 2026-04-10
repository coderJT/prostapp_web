import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { BarChart3, TrendingDown, TrendingUp, Download, Share2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function Results() {
  const [assessmentHistory, setAssessmentHistory] = useState<any[]>([]);
  
  // Default mock data
  const defaultPsaData = [
    { date: 'Jan 2025', value: 2.1 },
    { date: 'Apr 2025', value: 2.3 },
    { date: 'Jul 2025', value: 2.5 },
    { date: 'Oct 2025', value: 2.6 },
    { date: 'Jan 2026', value: 2.7 },
    { date: 'Mar 2026', value: 2.8 },
  ];

  const defaultRiskTrendData = [
    { month: 'Sep', score: 15 },
    { month: 'Oct', score: 18 },
    { month: 'Nov', score: 16 },
    { month: 'Dec', score: 20 },
    { month: 'Jan', score: 19 },
    { month: 'Feb', score: 22 },
    { month: 'Mar', score: 21 },
  ];

  const defaultAssessmentHistory = [
    {
      id: 1,
      date: '2026-03-15',
      riskLevel: 'Low',
      riskScore: 21,
      color: 'green',
    },
    {
      id: 2,
      date: '2025-12-10',
      riskLevel: 'Low',
      riskScore: 19,
      color: 'green',
    },
    {
      id: 3,
      date: '2025-09-05',
      riskLevel: 'Low',
      riskScore: 15,
      color: 'green',
    },
  ];

  useEffect(() => {
    // Load assessment history from localStorage if available
    const savedAssessments = localStorage.getItem('assessmentHistory');
    if (savedAssessments) {
      try {
        const parsed = JSON.parse(savedAssessments);
        setAssessmentHistory(parsed.length > 0 ? parsed : defaultAssessmentHistory);
      } catch {
        setAssessmentHistory(defaultAssessmentHistory);
      }
    } else {
      setAssessmentHistory(defaultAssessmentHistory);
    }
  }, []);

  const psaData = defaultPsaData;
  const riskTrendData = defaultRiskTrendData;
  
  // Get current risk level and score from latest assessment
  const currentAssessment = assessmentHistory.length > 0 ? assessmentHistory[0] : defaultAssessmentHistory[0];
  const currentRiskLevel = currentAssessment?.riskLevel || 'Low';
  const currentRiskScore = currentAssessment?.riskScore || 21;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Assessment Results</h1>
          <p className="text-gray-600">Track your health metrics and risk trends over time</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Current Status */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Current Risk Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-green-600">{currentRiskLevel}</div>
                <p className="text-sm text-gray-500 mt-1">Score: {currentRiskScore}/100</p>
              </div>
              <TrendingDown className="h-10 w-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Latest PSA Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-blue-600">2.8</div>
                <p className="text-sm text-gray-500 mt-1">ng/mL (Normal)</p>
              </div>
              <TrendingUp className="h-10 w-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Assessments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-purple-600">{assessmentHistory.length}</div>
                <p className="text-sm text-gray-500 mt-1">Last 6 months</p>
              </div>
              <BarChart3 className="h-10 w-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Data */}
      <Tabs defaultValue="psa" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="psa">PSA Trend</TabsTrigger>
          <TabsTrigger value="risk">Risk History</TabsTrigger>
          <TabsTrigger value="assessments">Past Assessments</TabsTrigger>
        </TabsList>

        <TabsContent value="psa">
          <Card>
            <CardHeader>
              <CardTitle>PSA Level Trend</CardTitle>
              <CardDescription>Your PSA levels over the past 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={psaData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis label={{ value: 'PSA (ng/mL)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="PSA Level"
                      dot={{ fill: '#3b82f6', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Insights</h4>
                <p className="text-sm text-blue-800">
                  Your PSA levels show a gradual increase but remain within the normal range. 
                  Continue regular monitoring and maintain a healthy lifestyle.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card>
            <CardHeader>
              <CardTitle>Risk Score Trend</CardTitle>
              <CardDescription>Your calculated risk scores over the past 7 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis label={{ value: 'Risk Score', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Bar 
                      dataKey="score" 
                      fill="#22c55e" 
                      name="Risk Score"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Analysis</h4>
                <p className="text-sm text-green-800">
                  Your risk score has remained consistently low over the monitoring period. 
                  This indicates good prostate health and effective management.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments">
          <Card>
            <CardHeader>
              <CardTitle>Assessment History</CardTitle>
              <CardDescription>Complete history of your risk assessments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assessmentHistory.map((assessment) => (
                  <div 
                    key={assessment.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`
                        w-16 h-16 rounded-full flex items-center justify-center
                        ${assessment.color === 'green' ? 'bg-green-100' : ''}
                        ${assessment.color === 'yellow' ? 'bg-yellow-100' : ''}
                        ${assessment.color === 'red' ? 'bg-red-100' : ''}
                      `}>
                        <span className={`
                          text-xl font-bold
                          ${assessment.color === 'green' ? 'text-green-700' : ''}
                          ${assessment.color === 'yellow' ? 'text-yellow-700' : ''}
                          ${assessment.color === 'red' ? 'text-red-700' : ''}
                        `}>
                          {assessment.riskScore}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant="secondary"
                            className={
                              assessment.color === 'green' ? 'bg-green-100 text-green-800' : 
                              assessment.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-red-100 text-red-800'
                            }
                          >
                            {assessment.riskLevel} Risk
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {new Date(assessment.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">Risk Score: {assessment.riskScore}/100</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
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
