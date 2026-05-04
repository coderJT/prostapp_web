import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { AlertCircle, Eye, EyeOff, Lock, Mail, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from '../components/AuthShell';
import { getStoredUser, getUserHomePath, saveUserSession } from '../auth/session';
import { buildApiUrl } from '../lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<'patient' | 'admin'>('patient');
  const [clinicalRole, setClinicalRole] = useState<'doctor' | 'nurse' | 'clinician' | ''>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const existingUser = getStoredUser();
    if (existingUser) {
      navigate(getUserHomePath(existingUser), { replace: true });
    }
  }, [navigate]);

  const isAdminUser = (user: { is_clinician?: boolean; role?: string }) => {
    return user?.is_clinician === true || user?.role === 'admin';
  };

  const normalizeAuthUser = (user: any, selectedModeIsAdmin: boolean) => {
    const adminAccess = isAdminUser(user);
    const fullName =
      user.full_name ||
      [user.user_first_name, user.user_last_name].filter(Boolean).join(' ') ||
      user.email ||
      user.user_email;

    return {
      id: user.id,
      email: user.email || user.user_email,
      name: fullName,
      phone: user.phone || user.user_phone_number || null,
      role: selectedModeIsAdmin && adminAccess ? 'admin' : 'patient',
      clinicalRole: selectedModeIsAdmin && adminAccess ? (user.clinical_role || 'clinician') : null,
      created_at: user.created_at,
    };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Simulate login - in production, this would call your authentication API
      if (!email || !password) {
        setError('Please enter both email and password');
        setLoading(false);
        return;
      }

      if (accountType === 'admin' && !clinicalRole) {
        setError('Please select your admin role (doctor, nurse, or clinician)');
        setLoading(false);
        return;
      }

      const loginUrl = buildApiUrl('/api/auth/login');
      if (!loginUrl) {
        throw new Error('Authentication backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
      }

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          role: accountType,
          clinicalRole: accountType === 'admin' ? clinicalRole : null,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success || !payload?.user) {
        throw new Error(payload?.error || 'Login failed. Please try again.');
      }

      const user = payload.user;
      const selectedModeIsAdmin = accountType === 'admin';
      const normalizedUser = normalizeAuthUser(user, selectedModeIsAdmin);
      const savedUser = saveUserSession(normalizedUser);

      if (!savedUser) {
        throw new Error('Could not save your login session. Please enable browser storage and try again.');
      }
      
      toast.success('Login successful!');
      navigate(getUserHomePath(savedUser));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      description="Choose your role, sign in, and continue where you left off."
      sideTitle="Your health dashboard should feel simple from the first click."
      sideDescription="ProstAPP keeps the sign-in flow focused so patients and clinicians can get to assessments, appointments, and results quickly."
    >
      <form onSubmit={handleLogin} className="space-y-5">
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-600" />
            <div>
              <p className="font-medium">We could not sign you in</p>
              <p className="mt-1 leading-5">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-sm font-semibold text-slate-800">I am signing in as</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={accountType === 'patient'}
              onClick={() => {
                setAccountType('patient');
                setClinicalRole('');
              }}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                accountType === 'patient'
                  ? 'border-sky-500 bg-sky-50 text-sky-950 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sky-600 shadow-sm">
                <UserRound className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold">Patient</span>
                <span className="block text-xs text-slate-500">Assessment and results</span>
              </span>
            </button>

            <button
              type="button"
              aria-pressed={accountType === 'admin'}
              onClick={() => setAccountType('admin')}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                accountType === 'admin'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                <Stethoscope className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold">Clinical team</span>
                <span className="block text-xs text-slate-500">Appointments and admin</span>
              </span>
            </button>
          </div>
        </div>

        {accountType === 'admin' && (
          <div className="space-y-2">
            <Label htmlFor="clinicalRole" className="text-sm font-semibold text-slate-800">
              Clinical role
            </Label>
            <select
              id="clinicalRole"
              value={clinicalRole}
              onChange={(e) => setClinicalRole(e.target.value as 'doctor' | 'nurse' | 'clinician' | '')}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">Select your role</option>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="clinician">Clinician</option>
            </select>
            <p className="text-xs leading-5 text-slate-500">Clinical accounts use approved medical staff access.</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-semibold text-slate-800">
            Email address
          </Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-2xl border-slate-200 bg-white pl-12 text-base shadow-sm focus-visible:ring-sky-100"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password" className="text-sm font-semibold text-slate-800">
              Password
            </Label>
            <button type="button" className="text-sm font-medium text-sky-700 transition hover:text-sky-900">
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-2xl border-slate-200 bg-white px-12 text-base shadow-sm focus-visible:ring-sky-100"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="h-12 w-full rounded-2xl bg-slate-950 text-base font-semibold hover:bg-slate-800" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          <div className="mb-1 flex items-center gap-2 font-medium text-slate-800">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Secure access
          </div>
          Use the email and password linked to your ProstAPP account.
        </div>

        <p className="text-center text-sm text-slate-600">
          New to ProstAPP?{' '}
          <Link to="/signup" className="font-semibold text-sky-700 transition hover:text-sky-900">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
