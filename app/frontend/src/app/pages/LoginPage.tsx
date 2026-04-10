import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Activity, Mail, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888';

export function LoginPage() {
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<'patient' | 'admin'>('patient');
  const [clinicalRole, setClinicalRole] = useState<'doctor' | 'nurse' | 'clinician' | ''>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAdminUser = (user: { is_clinician?: boolean; role?: string }) => {
    return user?.is_clinician === true || user?.role === 'admin';
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

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
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
      const adminAccess = isAdminUser(user);
      const selectedModeIsAdmin = accountType === 'admin';
      const normalizedUser = {
        id: user.id,
        email: user.user_email,
        name: [user.user_first_name, user.user_last_name].filter(Boolean).join(' '),
        phone: user.user_phone_number,
        role: selectedModeIsAdmin && adminAccess ? 'admin' : 'patient',
        clinicalRole: selectedModeIsAdmin && adminAccess ? 'clinician' : null,
        created_at: user.created_at,
      };

      localStorage.setItem('user', JSON.stringify(normalizedUser));
      
      toast.success('Login successful!');
      navigate(selectedModeIsAdmin && adminAccess ? '/admin' : '/dashboard/risk-assessment');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-2">
            <Activity className="h-10 w-10 text-blue-600" />
            <span className="text-3xl font-bold text-gray-900">ProstAPP</span>
          </Link>
          <p className="text-gray-600">Prostate Cancer Risk Prediction</p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>Sign in to access your health dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Sign in as</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={accountType === 'patient' ? 'default' : 'outline'}
                    onClick={() => {
                      setAccountType('patient');
                      setClinicalRole('');
                    }}
                  >
                    Patient
                  </Button>
                  <Button
                    type="button"
                    variant={accountType === 'admin' ? 'default' : 'outline'}
                    onClick={() => setAccountType('admin')}
                  >
                    Admin
                  </Button>
                </div>
                {accountType === 'admin' && (
                  <div className="space-y-2">
                    <Label htmlFor="clinicalRole">Admin Role</Label>
                    <select
                      id="clinicalRole"
                      value={clinicalRole}
                      onChange={(e) => setClinicalRole(e.target.value as 'doctor' | 'nurse' | 'clinician' | '')}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select your role</option>
                      <option value="doctor">Doctor</option>
                      <option value="nurse">Nurse</option>
                      <option value="clinician">Clinician</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <a href="#" className="text-sm text-blue-600 hover:underline">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">or</span>
                </div>
              </div>

              <div className="text-center text-sm">
                <span className="text-gray-600">Don't have an account? </span>
                <Link to="/signup" className="text-blue-600 font-medium hover:underline">
                  Sign up
                </Link>
              </div>

              <div className="text-center text-xs text-gray-500 mt-4">
                <p>Use your registered account credentials.</p>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-600">
          <Link to="/" className="hover:text-gray-900">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
