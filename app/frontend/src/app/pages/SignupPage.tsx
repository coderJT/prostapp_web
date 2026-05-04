import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail, Phone, ShieldCheck, Stethoscope, User, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from '../components/AuthShell';
import { getStoredUser, getUserHomePath, saveUserSession } from '../auth/session';
import { buildApiUrl } from '../lib/api';
const ADMIN_EMAIL_DOMAIN = 'monashmedical.com';

export function SignupPage() {
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<'patient' | 'admin'>('patient');
  const [clinicalRole, setClinicalRole] = useState<'doctor' | 'nurse' | 'clinician' | ''>('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const existingUser = getStoredUser();
    if (existingUser) {
      navigate(getUserHomePath(existingUser), { replace: true });
    }
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validation
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters long');
        setLoading(false);
        return;
      }

      if (!agreedToTerms) {
        setError('Please agree to the terms and conditions');
        setLoading(false);
        return;
      }

      if (accountType === 'admin' && !clinicalRole) {
        setError('Please select an admin role (doctor, nurse, or clinician)');
        setLoading(false);
        return;
      }

      const normalizedEmail = formData.email.trim().toLowerCase();

      if (accountType === 'admin' && !normalizedEmail.endsWith(`@${ADMIN_EMAIL_DOMAIN}`)) {
        setError('Invalid email');
        setLoading(false);
        return;
      }

      const signupUrl = buildApiUrl('/api/auth/signup');
      if (!signupUrl) {
        throw new Error('Authentication backend unavailable. Set VITE_API_BASE_URL for deployed environments.');
      }

      const response = await fetch(signupUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || null,
          role: accountType,
          clinicalRole: accountType === 'admin' ? clinicalRole : null,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success || !payload?.user) {
        throw new Error(payload?.error || 'Signup failed. Please try again.');
      }

      const user = payload.user;
      const adminAccess = user?.is_clinician === true || user?.role === 'admin';
      const fullName =
        user.full_name ||
        [user.user_first_name, user.user_last_name].filter(Boolean).join(' ') ||
        user.email ||
        user.user_email;

      const savedUser = saveUserSession({
        id: user.id,
        email: user.email || user.user_email,
        name: fullName,
        phone: user.phone || user.user_phone_number || null,
        role: adminAccess ? 'admin' : 'patient',
        clinicalRole: adminAccess ? (user.clinical_role || 'clinician') : null,
        created_at: user.created_at,
      });

      if (!savedUser) {
        throw new Error('Could not save your login session. Please enable browser storage and try again.');
      }
      
      toast.success('Account created successfully!');
      navigate(getUserHomePath(savedUser));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed. Please try again.';
      setError(message);
      toast.error('Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      description="Set up a patient or clinical account in a few clear steps."
      sideTitle="Start with a profile that fits your role."
      sideDescription="Patients can begin assessments quickly, while clinical staff can manage appointments and care coordination from a dedicated view."
    >
      <form onSubmit={handleSignup} className="space-y-5">
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-600" />
            <div>
              <p className="font-medium">Let’s fix this before continuing</p>
              <p className="mt-1 leading-5">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-sm font-semibold text-slate-800">Account type</Label>
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
                <span className="block text-xs text-slate-500">Risk checks and reports</span>
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
                <span className="block text-xs text-slate-500">Staff dashboard access</span>
              </span>
            </button>
          </div>
        </div>

        {accountType === 'admin' && (
          <div className="space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <Label htmlFor="adminRole" className="text-sm font-semibold text-slate-800">
              Clinical role
            </Label>
            <select
              id="adminRole"
              value={clinicalRole}
              onChange={(e) => setClinicalRole(e.target.value as 'doctor' | 'nurse' | 'clinician' | '')}
              className="h-12 w-full rounded-2xl border border-emerald-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">Select your role</option>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="clinician">Clinician</option>
            </select>
            <p className="text-xs leading-5 text-emerald-800">Clinical accounts must use a @{ADMIN_EMAIL_DOMAIN} email address.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-sm font-semibold text-slate-800">
              First name
            </Label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="firstName"
                name="firstName"
                type="text"
                placeholder="First name"
                value={formData.firstName}
                onChange={handleChange}
                className="h-12 rounded-2xl border-slate-200 bg-white pl-12 text-base shadow-sm focus-visible:ring-sky-100"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-sm font-semibold text-slate-800">
              Last name
            </Label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="lastName"
                name="lastName"
                type="text"
                placeholder="Last name"
                value={formData.lastName}
                onChange={handleChange}
                className="h-12 rounded-2xl border-slate-200 bg-white pl-12 text-base shadow-sm focus-visible:ring-sky-100"
                required
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-semibold text-slate-800">
            Email address
          </Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={accountType === 'admin' ? `name@${ADMIN_EMAIL_DOMAIN}` : 'you@example.com'}
              value={formData.email}
              onChange={handleChange}
              className="h-12 rounded-2xl border-slate-200 bg-white pl-12 text-base shadow-sm focus-visible:ring-sky-100"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-semibold text-slate-800">
            Phone number <span className="font-normal text-slate-400">optional</span>
          </Label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+60 12 345 6789"
              value={formData.phone}
              onChange={handleChange}
              className="h-12 rounded-2xl border-slate-200 bg-white pl-12 text-base shadow-sm focus-visible:ring-sky-100"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold text-slate-800">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 8 characters"
                value={formData.password}
                onChange={handleChange}
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

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-800">
              Confirm password
            </Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repeat password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="h-12 rounded-2xl border-slate-200 bg-white pl-12 text-base shadow-sm focus-visible:ring-sky-100"
                required
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <div className="mb-2 flex items-center gap-2 font-medium text-slate-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Before you continue
          </div>
          <label htmlFor="terms" className="flex cursor-pointer items-start gap-3 leading-6">
            <Checkbox
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              className="mt-1"
            />
            <span>
              I agree to the{' '}
              <a href="#" className="font-medium text-sky-700 hover:text-sky-900">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="font-medium text-sky-700 hover:text-sky-900">
                Privacy Policy
              </a>
            </span>
          </label>
        </div>

        <Button type="submit" className="h-12 w-full rounded-2xl bg-slate-950 text-base font-semibold hover:bg-slate-800" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </Button>

        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4" />
            No confirmation email needed
          </div>
          Your account is created ready to use in this local setup.
        </div>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-sky-700 transition hover:text-sky-900">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
