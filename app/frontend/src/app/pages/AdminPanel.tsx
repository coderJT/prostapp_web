import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Activity,
  Users,
  TrendingUp,
  FileText,
  Search,
  MoreVertical,
  ArrowLeft,
  Plus,
  Shield,
  BarChart3,
  Clock,
  Eye,
  Loader,
  LogOut,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { clearUserSession, getStoredUser, isAdminUser } from '../auth/session';
import { supabase } from '../lib/supabase';
import { buildApiUrl } from '../lib/api';
import { toast } from 'sonner';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

type UserRow = {
  id: string;
  name: string;
  email: string;
  joined: string;
  role: string;
};

type ReportRow = {
  id: string | number;
  user_email: string;
  risk_level: string;
  risk_score: number;
  source: string;
  created_at: string;
  prediction_value?: number | null;
  prediction_class?: string | null;
  csv_type?: string | null;
  csv_file_name?: string | null;
  lime_summary?: string | null;
  shap_summary?: string | null;
  top_lime_features?: unknown[];
  top_shap_features?: unknown[];
  feature_notes?: Array<Record<string, unknown>>;
};

const shellClass =
  'rounded-[2rem] border border-white/80 bg-white/90 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-black/25';

function sourceLabel(source: string) {
  if (source === 'ml-invasive') return 'PSA / invasive';
  if (source === 'ml-ftir') return 'FTIR / non-invasive';
  if (source === 'form') return 'Manual';
  return source || 'N/A';
}

function riskBadgeClass(riskLevel: string) {
  return riskLevel?.toLowerCase() === 'high'
    ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'
    : riskLevel?.toLowerCase() === 'low'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
      : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200';
}

function formatProbability(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${(numeric * 100).toFixed(2)}%` : 'Not available';
}

export function AdminPanel() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userSortKey, setUserSortKey] = useState('newest');
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportRiskFilter, setReportRiskFilter] = useState('all');
  const [reportSourceFilter, setReportSourceFilter] = useState('all');
  const [reportSortKey, setReportSortKey] = useState('newest');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    const user = getStoredUser();
    if (!user) { navigate('/login'); return; }
    if (!isAdminUser(user)) { navigate('/login'); return; }
    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, reportsRes] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('prediction_reports').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

      if (usersRes.data) {
        setUsers(usersRes.data.map((u: any) => ({
          id: u.id,
          name: `${u.user_first_name} ${u.user_last_name}`.trim(),
          email: u.user_email,
          joined: u.created_at,
          role: u.is_clinician ? 'Clinician' : 'Patient',
        })));
      }

      if (reportsRes.data) {
        setReports(reportsRes.data.map((r: any) => ({
          id: r.id,
          user_email: r.user_email || 'Unknown',
          risk_level: r.risk_level || 'N/A',
          risk_score: r.risk_score ?? 0,
          source: r.source || 'N/A',
          created_at: r.created_at,
          prediction_value: r.prediction_value ?? null,
          prediction_class: r.prediction_class ?? null,
          csv_type: r.csv_type ?? null,
          csv_file_name: r.csv_file_name ?? null,
          lime_summary: r.lime_summary ?? null,
          shap_summary: r.shap_summary ?? null,
          top_lime_features: Array.isArray(r.top_lime_features) ? r.top_lime_features : [],
          top_shap_features: Array.isArray(r.top_shap_features) ? r.top_shap_features : [],
          feature_notes: Array.isArray(r.feature_notes) ? r.feature_notes : [],
        })));
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalUsers = users.length;
  const totalReports = reports.length;
  const clinicianCount = users.filter(u => u.role === 'Clinician').length;

  const riskDistribution = useMemo(() => {
    const low = reports.filter(r => r.risk_level?.toLowerCase() === 'low').length;
    const moderate = reports.filter(r => ['moderate', 'medium'].includes(r.risk_level?.toLowerCase())).length;
    const high = reports.filter(r => r.risk_level?.toLowerCase() === 'high').length;
    return [
      { name: 'Low Risk', value: low || 0, color: '#22c55e' },
      { name: 'Moderate', value: moderate || 0, color: '#f59e0b' },
      { name: 'High Risk', value: high || 0, color: '#ef4444' },
    ];
  }, [reports]);

  // Source breakdown: how many assessments from each method
  const sourceBreakdown = useMemo(() => {
    const psaCount = reports.filter(r => r.source === 'ml-invasive').length;
    const ftirCount = reports.filter(r => r.source === 'ml-ftir').length;
    const formCount = reports.filter(r => r.source === 'form' || !['ml-invasive', 'ml-ftir'].includes(r.source)).length;
    return [
      { name: 'PSA/Invasive', count: psaCount, fill: '#3b82f6' },
      { name: 'FTIR', count: ftirCount, fill: '#10b981' },
      { name: 'Manual Entry', count: formCount, fill: '#8b5cf6' },
    ];
  }, [reports]);

  // Risk trend: group reports by month
  const riskTrend = useMemo(() => {
    const months: Record<string, { month: string; low: number; moderate: number; high: number }> = {};
    reports.forEach(r => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) months[key] = { month: key, low: 0, moderate: 0, high: 0 };
      const lvl = r.risk_level?.toLowerCase();
      if (lvl === 'low') months[key].low++;
      else if (lvl === 'high') months[key].high++;
      else months[key].moderate++;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [reports]);

  // Average risk score
  const avgRiskScore = useMemo(() => {
    if (reports.length === 0) return 0;
    return Math.round(reports.reduce((sum, r) => sum + (r.risk_score || 0), 0) / reports.length);
  }, [reports]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = users.filter((u) => {
      const matchesQuery =
        !query ||
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.id.toLowerCase().includes(query);
      const matchesRole = userRoleFilter === 'all' || u.role.toLowerCase() === userRoleFilter;
      return matchesQuery && matchesRole;
    });

    return [...filtered].sort((a, b) => {
      if (userSortKey === 'name-asc') return a.name.localeCompare(b.name);
      if (userSortKey === 'name-desc') return b.name.localeCompare(a.name);
      if (userSortKey === 'oldest') return new Date(a.joined).getTime() - new Date(b.joined).getTime();
      return new Date(b.joined).getTime() - new Date(a.joined).getTime();
    });
  }, [searchQuery, userRoleFilter, userSortKey, users]);

  const filteredReports = useMemo(() => {
    const query = reportSearchQuery.trim().toLowerCase();
    const filtered = reports.filter((r) => {
      const matchesQuery =
        !query ||
        String(r.id).toLowerCase().includes(query) ||
        r.user_email.toLowerCase().includes(query) ||
        r.source.toLowerCase().includes(query) ||
        (r.csv_file_name || '').toLowerCase().includes(query);
      const normalizedRisk = r.risk_level?.toLowerCase();
      const matchesRisk = reportRiskFilter === 'all' || normalizedRisk === reportRiskFilter;
      const matchesSource = reportSourceFilter === 'all' || r.source === reportSourceFilter;
      return matchesQuery && matchesRisk && matchesSource;
    });

    return [...filtered].sort((a, b) => {
      if (reportSortKey === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (reportSortKey === 'score-high') return (b.risk_score || 0) - (a.risk_score || 0);
      if (reportSortKey === 'score-low') return (a.risk_score || 0) - (b.risk_score || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [reportRiskFilter, reportSearchQuery, reportSortKey, reportSourceFilter, reports]);

  const handleSaveUser = async () => {
    if (!editingUser) return;
    const parts = editingUser.name.split(' ');
    const { error } = await supabase.from('users').update({
      user_first_name: parts[0] || '',
      user_last_name: parts.slice(1).join(' ') || '',
    }).eq('id', editingUser.id);
    if (error) { toast.error(error.message); return; }
    setEditingUser(null);
    toast.success('User updated!');
    fetchData();
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('users').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    setDeleteTarget(null);
    toast.success('User removed.');
    fetchData();
  };

  const handleAddUser = async () => {
    const name = newUser.name.trim();
    const email = newUser.email.trim().toLowerCase();
    const password = newUser.password;

    if (!name || !email) { toast.error('Name and email required.'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters long.'); return; }

    const signupUrl = buildApiUrl('/api/auth/signup');
    if (!signupUrl) { toast.error('Authentication service unavailable.'); return; }

    const parts = name.split(/\s+/);
    try {
      const response = await fetch(signupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' ') || '',
          phone: '0000000000',
          role: 'patient',
          clinicalRole: null,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to add user.');
      }

      setNewUser({ name: '', email: '', password: '' });
      setIsAddUserDialogOpen(false);
      toast.success('User added!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add user.');
    }
  };

  const recentReports = reports.slice(0, 8);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4 animate-in fade-in">
          <Loader className="h-10 w-10 animate-spin text-sky-600 mx-auto" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Loading admin dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                <Shield className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white">ProstAPP Admin</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/dashboard/risk-assessment">
              <Button variant="outline" size="sm" className="rounded-xl border-slate-200 dark:border-slate-700 dark:text-slate-100">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to App
              </Button>
            </Link>
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => { clearUserSession(); navigate('/'); }}>
              <LogOut className="h-4 w-4 lg:mr-2" />
              <span className="hidden lg:inline">Logout</span>
            </Button>
            <LanguageSwitcher className="hidden md:flex" />
          </div>
        </div>
        <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800 md:hidden">
          <LanguageSwitcher className="justify-end" size="md" />
        </div>
      </header>

      <div className="p-4 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Title */}
          <div className={`${shellClass} p-6`}>
            <div className="mb-2 flex items-center gap-3 text-sm font-medium text-sky-700 dark:text-sky-300">
              <BarChart3 className="h-5 w-5" /> Admin workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white">Dashboard Overview</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Real-time platform metrics from your Supabase database.
            </p>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: totalUsers, icon: Users, accent: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' },
              { label: 'Clinicians', value: clinicianCount, icon: Shield, accent: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300' },
              { label: 'Total Assessments', value: totalReports, icon: Activity, accent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
              { label: 'High Risk Cases', value: riskDistribution[2].value, icon: TrendingUp, accent: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' },
            ].map((s) => (
              <Card key={s.label} className="rounded-[1.75rem] border-white/80 bg-white/90 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${s.accent}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{s.label}</p>
                    <p className="text-2xl font-bold text-slate-950 dark:text-white">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="rounded-2xl bg-slate-100 dark:bg-slate-900 p-1">
              <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
              <TabsTrigger value="insights" className="rounded-xl">Insights</TabsTrigger>
              <TabsTrigger value="users" className="rounded-xl">Users</TabsTrigger>
              <TabsTrigger value="reports" className="rounded-xl">Reports</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Risk Distribution */}
                <Card className="rounded-[2rem] dark:border-slate-800 dark:bg-slate-900">
                  <CardHeader>
                    <CardTitle className="text-slate-950 dark:text-white">Risk Distribution</CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400">Breakdown across all saved assessments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {reports.length > 0 ? (
                      <>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={riskDistribution} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                                {riskDistribution.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-4">
                          {riskDistribution.map((item) => (
                            <div key={item.name} className="text-center">
                              <div className="flex items-center justify-center gap-2 mb-1">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{item.name}</span>
                              </div>
                              <p className="text-xl font-bold text-slate-950 dark:text-white">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No assessment data available yet.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card className="rounded-[2rem] dark:border-slate-800 dark:bg-slate-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                      <Clock className="h-5 w-5 text-sky-600 dark:text-sky-400" /> Recent Assessments
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400">Latest prediction reports from all users</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {recentReports.length > 0 ? (
                      <div className="space-y-3">
                        {recentReports.map((r) => (
                          <div key={r.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.user_email}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {sourceLabel(r.source)} · {new Date(r.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge className={`rounded-full px-2.5 py-0.5 text-xs border ${riskBadgeClass(r.risk_level)}`}>{r.risk_level} ({r.risk_score})</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No reports available yet.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-[2rem] dark:border-slate-800 dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-slate-950 dark:text-white">User explorer</CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">Search, filter, and sort the user list from the overview.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Search name, email, or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="rounded-xl pl-10"
                      />
                    </div>
                    <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All roles</SelectItem>
                        <SelectItem value="patient">Patients</SelectItem>
                        <SelectItem value="clinician">Clinicians</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={userSortKey} onValueChange={setUserSortKey}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest first</SelectItem>
                        <SelectItem value="oldest">Oldest first</SelectItem>
                        <SelectItem value="name-asc">Name A-Z</SelectItem>
                        <SelectItem value="name-desc">Name Z-A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredUsers.slice(0, 6).map((user) => (
                      <div key={user.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-950 dark:text-white">{user.name || 'Unnamed user'}</p>
                            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                          </div>
                          <Badge className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${user.role === 'Clinician' ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200' : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200'}`}>
                            {user.role}
                          </Badge>
                        </div>
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Joined {new Date(user.joined).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                  {filteredUsers.length === 0 && (
                    <p className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                      No users match the current filters.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-6">
              {/* Quick Stats Row */}
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="rounded-[2rem] dark:border-slate-800 dark:bg-slate-900">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Average Risk Score</p>
                    <p className="text-4xl font-bold text-slate-950 dark:text-white">{avgRiskScore}<span className="text-lg text-slate-400">/100</span></p>
                  </CardContent>
                </Card>
                <Card className="rounded-[2rem] dark:border-slate-800 dark:bg-slate-900">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Most Used Model</p>
                    <p className="text-2xl font-bold text-slate-950 dark:text-white">
                      {sourceBreakdown.sort((a, b) => b.count - a.count)[0]?.name || 'N/A'}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{sourceBreakdown.sort((a, b) => b.count - a.count)[0]?.count || 0} assessments</p>
                  </CardContent>
                </Card>
                <Card className="rounded-[2rem] dark:border-slate-800 dark:bg-slate-900">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">High Risk Rate</p>
                    <p className="text-4xl font-bold text-rose-600 dark:text-rose-400">
                      {totalReports > 0 ? Math.round((riskDistribution[2].value / totalReports) * 100) : 0}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Assessment Source Breakdown */}
                <Card className="rounded-[2rem] dark:border-slate-800 dark:bg-slate-900">
                  <CardHeader>
                    <CardTitle className="text-slate-950 dark:text-white">Assessment Source Breakdown</CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400">Which prediction methods are being used</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {totalReports > 0 ? (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={sourceBreakdown} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                            <Tooltip contentStyle={{ borderRadius: '1rem', border: '1px solid #d1d5db' }} />
                            <Bar dataKey="count" radius={[0, 12, 12, 0]}>
                              {sourceBreakdown.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No data yet.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Risk Trend Over Time */}
                <Card className="rounded-[2rem] dark:border-slate-800 dark:bg-slate-900">
                  <CardHeader>
                    <CardTitle className="text-slate-950 dark:text-white">Risk Trends Over Time</CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400">Monthly breakdown of risk levels</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {riskTrend.length > 0 ? (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={riskTrend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis />
                            <Tooltip contentStyle={{ borderRadius: '1rem', border: '1px solid #d1d5db' }} />
                            <Legend />
                            <Bar dataKey="low" name="Low" fill="#22c55e" stackId="a" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="moderate" name="Moderate" fill="#f59e0b" stackId="a" />
                            <Bar dataKey="high" name="High" fill="#ef4444" stackId="a" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No data yet.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users">
              <Card className="rounded-[2rem] dark:border-slate-800 dark:bg-slate-900">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-slate-950 dark:text-white">User Management</CardTitle>
                      <CardDescription className="text-slate-600 dark:text-slate-400">{totalUsers} registered users from Supabase</CardDescription>
                    </div>
                    <Button onClick={() => setIsAddUserDialogOpen(true)} className="rounded-2xl bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400">
                      <Plus className="h-4 w-4 mr-2" /> Add User
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span>{filteredUsers.length} of {totalUsers} users shown</span>
                    {(searchQuery || userRoleFilter !== 'all' || userSortKey !== 'newest') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-xl"
                        onClick={() => {
                          setSearchQuery('');
                          setUserRoleFilter('all');
                          setUserSortKey('newest');
                        }}
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                  <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input placeholder="Search users by name, email, or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" />
                    </div>
                    <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All roles</SelectItem>
                        <SelectItem value="patient">Patients</SelectItem>
                        <SelectItem value="clinician">Clinicians</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={userSortKey} onValueChange={setUserSortKey}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest first</SelectItem>
                        <SelectItem value="oldest">Oldest first</SelectItem>
                        <SelectItem value="name-asc">Name A-Z</SelectItem>
                        <SelectItem value="name-desc">Name Z-A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-950">
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell><Badge variant="outline" className="rounded-lg text-xs dark:border-slate-700 dark:text-slate-300">{user.id}</Badge></TableCell>
                            <TableCell className="font-medium text-slate-900 dark:text-slate-100">{user.name}</TableCell>
                            <TableCell className="text-slate-600 dark:text-slate-400">{user.email}</TableCell>
                            <TableCell className="text-slate-600 dark:text-slate-400">{new Date(user.joined).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge className={`rounded-full border px-2.5 py-0.5 text-xs ${user.role === 'Clinician' ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200' : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200'}`}>{user.role}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditingUser({ ...user })}>Edit</Button>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40" onClick={() => setDeleteTarget(user)}>Delete</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredUsers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                              No users match the current filters.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports">
              <Card className="rounded-[2rem] dark:border-slate-800 dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                    <FileText className="h-5 w-5 text-sky-600 dark:text-sky-400" /> All Prediction Reports
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">{filteredReports.length} of {totalReports} reports from the prediction_reports table</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6 grid gap-3 xl:grid-cols-[1fr_180px_210px_180px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Search reports by user, source, file, or ID..."
                        value={reportSearchQuery}
                        onChange={(e) => setReportSearchQuery(e.target.value)}
                        className="rounded-xl pl-10"
                      />
                    </div>
                    <Select value={reportRiskFilter} onValueChange={setReportRiskFilter}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Risk" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All risks</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={reportSourceFilter} onValueChange={setReportSourceFilter}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All sources</SelectItem>
                        <SelectItem value="form">Manual</SelectItem>
                        <SelectItem value="ml-invasive">PSA / invasive</SelectItem>
                        <SelectItem value="ml-ftir">FTIR / non-invasive</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={reportSortKey} onValueChange={setReportSortKey}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest first</SelectItem>
                        <SelectItem value="oldest">Oldest first</SelectItem>
                        <SelectItem value="score-high">Highest score</SelectItem>
                        <SelectItem value="score-low">Lowest score</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-950">
                          <TableHead>ID</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Risk Level</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Report</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReports.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-slate-500 dark:text-slate-400">#{r.id}</TableCell>
                            <TableCell className="font-medium text-slate-900 dark:text-slate-100">{r.user_email}</TableCell>
                            <TableCell>
                              <Badge className={`rounded-full border px-2.5 py-0.5 text-xs ${riskBadgeClass(r.risk_level)}`}>{r.risk_level}</Badge>
                            </TableCell>
                            <TableCell className="text-slate-900 dark:text-slate-100 font-medium">{r.risk_score}/100</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="rounded-lg text-xs dark:border-slate-700 dark:text-slate-300">
                                {sourceLabel(r.source)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-500 dark:text-slate-400">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-8 rounded-xl px-2 text-xs" onClick={() => setSelectedReport(r)}>
                                <Eye className="mr-1.5 h-4 w-4" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredReports.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                              No reports match the current filters.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Report Detail Dialog */}
          <Dialog open={Boolean(selectedReport)} onOpenChange={(open) => !open && setSelectedReport(null)}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>Prediction Report</DialogTitle>
                <DialogDescription>
                  Full stored report details from prediction_reports.
                </DialogDescription>
              </DialogHeader>
              {selectedReport && (
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Risk</p>
                      <Badge className={`mt-2 rounded-full border px-2.5 py-0.5 text-xs ${riskBadgeClass(selectedReport.risk_level)}`}>
                        {selectedReport.risk_level} ({selectedReport.risk_score}/100)
                      </Badge>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Source</p>
                      <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{sourceLabel(selectedReport.source)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Probability</p>
                      <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{formatProbability(selectedReport.prediction_value)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Generated</p>
                      <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{new Date(selectedReport.created_at).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
                    <h3 className="font-semibold text-slate-950 dark:text-white">Report context</h3>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
                      <p><span className="font-medium text-slate-900 dark:text-slate-100">User:</span> {selectedReport.user_email}</p>
                      <p><span className="font-medium text-slate-900 dark:text-slate-100">Report ID:</span> {selectedReport.id}</p>
                      <p><span className="font-medium text-slate-900 dark:text-slate-100">CSV type:</span> {selectedReport.csv_type || 'N/A'}</p>
                      <p><span className="font-medium text-slate-900 dark:text-slate-100">Uploaded file:</span> {selectedReport.csv_file_name || 'N/A'}</p>
                      <p><span className="font-medium text-slate-900 dark:text-slate-100">Prediction class:</span> {selectedReport.prediction_class || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
                      <h3 className="font-semibold text-slate-950 dark:text-white">Patient-specific explanation</h3>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {selectedReport.lime_summary || 'No LIME summary was saved for this report.'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
                      <h3 className="font-semibold text-slate-950 dark:text-white">Model-wide explanation</h3>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {selectedReport.shap_summary || 'No SHAP summary was saved for this report.'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
                    <h3 className="font-semibold text-slate-950 dark:text-white">Feature interpretation notes</h3>
                    {selectedReport.feature_notes?.length ? (
                      <div className="mt-3 overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Feature</TableHead>
                              <TableHead>Value</TableHead>
                              <TableHead>Meaning</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedReport.feature_notes.slice(0, 10).map((note, index) => (
                              <TableRow key={`${String(note.feature || note.display_feature || index)}-${index}`}>
                                <TableCell className="font-medium">{String(note.displayFeature || note.display_feature || note.feature || 'Unknown feature')}</TableCell>
                                <TableCell>{String(note.displayValue || note.display_value || note.value || note.feature_value || 'N/A')}</TableCell>
                                <TableCell className="max-w-md text-slate-600 dark:text-slate-300">{String(note.meaning || 'No meaning saved.')}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No feature notes were saved for this report.</p>
                    )}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedReport(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog — outside Tabs so it always renders */}
          <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>Update user details.</DialogDescription>
              </DialogHeader>
              {editingUser && (
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Email (read-only)</label>
                    <Input value={editingUser.email} disabled className="opacity-60" />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button onClick={handleSaveUser}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Dialog */}
          <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete user?</AlertDialogTitle>
                <AlertDialogDescription>This will remove {deleteTarget?.name} ({deleteTarget?.email}) permanently.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteUser}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Add User Dialog */}
          <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>Create a new user in the system.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Full Name *</label>
                  <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="John Doe" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Email *</label>
                  <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@example.com" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Password *</label>
                  <Input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Minimum 8 characters"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">This password is used for the user's first login.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddUserDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddUser}>Add User</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
