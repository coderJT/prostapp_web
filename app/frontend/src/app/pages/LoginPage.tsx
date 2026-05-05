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
import { getPreferredLanguage, type LanguageCode } from '../lib/language';

const loginCopy = {
  en: {
    shell: {
      title: 'Welcome back',
      description: 'Choose your role, sign in, and continue where you left off.',
      sideTitle: 'Your health dashboard should feel simple from the first click.',
      sideDescription: 'ProstAPP keeps the sign-in flow focused so patients and clinicians can get to assessments, appointments, and results quickly.',
      home: 'Home',
      reminderTitle: 'Friendly reminder',
      reminderText: 'ProstAPP supports risk assessment and care planning. It does not replace clinical diagnosis or urgent care.',
      highlights: ['Guided risk checks with clear next steps', 'Private access for patients and clinical teams', 'Designed for quick, calm daily use'],
    },
    errors: {
      missing: 'Please enter both email and password',
      role: 'Please select your admin role (doctor, nurse, or clinician)',
      unavailable: 'Authentication backend unavailable. Set VITE_API_BASE_URL for deployed environments.',
      failed: 'Login failed. Please try again.',
      storage: 'Could not save your login session. Please enable browser storage and try again.',
      boxTitle: 'We could not sign you in',
      toastSuccess: 'Login successful!',
      toastError: 'Login failed',
    },
    roleLabel: 'I am signing in as',
    patient: 'Patient',
    patientDesc: 'Assessment and results',
    clinical: 'Clinical team',
    clinicalDesc: 'Appointments and admin',
    clinicalRole: 'Clinical role',
    selectRole: 'Select your role',
    doctor: 'Doctor',
    nurse: 'Nurse',
    clinician: 'Clinician',
    clinicalHint: 'Clinical accounts use approved medical staff access.',
    email: 'Email address',
    password: 'Password',
    forgot: 'Forgot password?',
    passwordPlaceholder: 'Enter your password',
    hidePassword: 'Hide password',
    showPassword: 'Show password',
    loading: 'Signing in...',
    submit: 'Sign in',
    secureTitle: 'Secure access',
    secureText: 'Use the email and password linked to your ProstAPP account.',
    newText: 'New to ProstAPP?',
    create: 'Create an account',
  },
  ms: {
    shell: {
      title: 'Selamat kembali',
      description: 'Pilih peranan anda, log masuk, dan teruskan kerja anda.',
      sideTitle: 'Papan pemuka kesihatan anda patut terasa mudah sejak klik pertama.',
      sideDescription: 'ProstAPP memastikan log masuk kekal fokus supaya pesakit dan klinisian boleh cepat ke penilaian, temu janji, dan keputusan.',
      home: 'Laman utama',
      reminderTitle: 'Peringatan mesra',
      reminderText: 'ProstAPP menyokong penilaian risiko dan perancangan penjagaan. Ia tidak menggantikan diagnosis klinikal atau rawatan segera.',
      highlights: ['Semakan risiko berpandu dengan langkah seterusnya yang jelas', 'Akses peribadi untuk pesakit dan pasukan klinikal', 'Direka untuk penggunaan harian yang cepat dan tenang'],
    },
    errors: {
      missing: 'Sila masukkan emel dan kata laluan',
      role: 'Sila pilih peranan admin anda (doktor, jururawat, atau klinisian)',
      unavailable: 'Backend pengesahan tidak tersedia.',
      failed: 'Log masuk gagal. Sila cuba lagi.',
      storage: 'Sesi log masuk tidak dapat disimpan. Sila aktifkan storan pelayar dan cuba lagi.',
      boxTitle: 'Kami tidak dapat log masuk anda',
      toastSuccess: 'Log masuk berjaya!',
      toastError: 'Log masuk gagal',
    },
    roleLabel: 'Saya log masuk sebagai',
    patient: 'Pesakit',
    patientDesc: 'Penilaian dan keputusan',
    clinical: 'Pasukan klinikal',
    clinicalDesc: 'Temu janji dan admin',
    clinicalRole: 'Peranan klinikal',
    selectRole: 'Pilih peranan anda',
    doctor: 'Doktor',
    nurse: 'Jururawat',
    clinician: 'Klinisian',
    clinicalHint: 'Akaun klinikal menggunakan akses staf perubatan yang diluluskan.',
    email: 'Alamat emel',
    password: 'Kata laluan',
    forgot: 'Lupa kata laluan?',
    passwordPlaceholder: 'Masukkan kata laluan anda',
    hidePassword: 'Sembunyikan kata laluan',
    showPassword: 'Tunjuk kata laluan',
    loading: 'Sedang log masuk...',
    submit: 'Log masuk',
    secureTitle: 'Akses selamat',
    secureText: 'Gunakan emel dan kata laluan yang dipautkan kepada akaun ProstAPP anda.',
    newText: 'Baharu di ProstAPP?',
    create: 'Cipta akaun',
  },
  zh: {
    shell: {
      title: '欢迎回来',
      description: '选择您的角色，登录并继续之前的操作。',
      sideTitle: '健康仪表板应从第一次点击开始就简单清晰。',
      sideDescription: 'ProstAPP 让登录流程保持专注，帮助患者和临床人员快速进入评估、预约和结果页面。',
      home: '主页',
      reminderTitle: '温馨提醒',
      reminderText: 'ProstAPP 支持风险评估和照护规划，但不能替代临床诊断或紧急医疗服务。',
      highlights: ['引导式风险评估和清晰下一步', '患者和临床团队的私密访问', '为快速、平静的日常使用而设计'],
    },
    errors: {
      missing: '请输入电子邮件和密码',
      role: '请选择管理员角色（医生、护士或临床人员）',
      unavailable: '认证后端不可用。',
      failed: '登录失败，请重试。',
      storage: '无法保存登录会话。请启用浏览器存储后重试。',
      boxTitle: '无法登录',
      toastSuccess: '登录成功！',
      toastError: '登录失败',
    },
    roleLabel: '登录身份',
    patient: '患者',
    patientDesc: '评估和结果',
    clinical: '临床团队',
    clinicalDesc: '预约和管理',
    clinicalRole: '临床角色',
    selectRole: '选择您的角色',
    doctor: '医生',
    nurse: '护士',
    clinician: '临床人员',
    clinicalHint: '临床账户使用已批准的医护人员访问权限。',
    email: '电子邮件地址',
    password: '密码',
    forgot: '忘记密码？',
    passwordPlaceholder: '输入您的密码',
    hidePassword: '隐藏密码',
    showPassword: '显示密码',
    loading: '正在登录...',
    submit: '登录',
    secureTitle: '安全访问',
    secureText: '请使用与您的 ProstAPP 账户关联的电子邮件和密码。',
    newText: '第一次使用 ProstAPP？',
    create: '创建账户',
  },
} as const;

export function LoginPage() {
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<'patient' | 'admin'>('patient');
  const [clinicalRole, setClinicalRole] = useState<'doctor' | 'nurse' | 'clinician' | ''>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState<LanguageCode>(() => getPreferredLanguage());
  const copy = loginCopy[language];

  useEffect(() => {
    const existingUser = getStoredUser();
    if (existingUser) {
      navigate(getUserHomePath(existingUser), { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<LanguageCode>).detail;
      if (nextLanguage) setLanguage(nextLanguage);
    };
    window.addEventListener('prostapp-language-change', handleLanguageChange);
    return () => window.removeEventListener('prostapp-language-change', handleLanguageChange);
  }, []);

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
        setError(copy.errors.missing);
        setLoading(false);
        return;
      }

      if (accountType === 'admin' && !clinicalRole) {
        setError(copy.errors.role);
        setLoading(false);
        return;
      }

      const loginUrl = buildApiUrl('/api/auth/login');
      if (!loginUrl) {
        throw new Error(copy.errors.unavailable);
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
        throw new Error(payload?.error || copy.errors.failed);
      }

      const user = payload.user;
      const selectedModeIsAdmin = accountType === 'admin';
      const normalizedUser = normalizeAuthUser(user, selectedModeIsAdmin);
      const savedUser = saveUserSession(normalizedUser);

      if (!savedUser) {
        throw new Error(copy.errors.storage);
      }
      
      toast.success(copy.errors.toastSuccess);
      navigate(getUserHomePath(savedUser));
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.errors.failed;
      setError(message);
      toast.error(copy.errors.toastError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={copy.shell.title}
      description={copy.shell.description}
      sideTitle={copy.shell.sideTitle}
      sideDescription={copy.shell.sideDescription}
      homeLabel={copy.shell.home}
      reminderTitle={copy.shell.reminderTitle}
      reminderText={copy.shell.reminderText}
      highlights={[...copy.shell.highlights]}
    >
      <form onSubmit={handleLogin} className="space-y-5">
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-600" />
            <div>
              <p className="font-medium">{copy.errors.boxTitle}</p>
              <p className="mt-1 leading-5">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-sm font-semibold text-slate-800">{copy.roleLabel}</Label>
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
                <span className="block font-semibold">{copy.patient}</span>
                <span className="block text-xs text-slate-500">{copy.patientDesc}</span>
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
                <span className="block font-semibold">{copy.clinical}</span>
                <span className="block text-xs text-slate-500">{copy.clinicalDesc}</span>
              </span>
            </button>
          </div>
        </div>

        {accountType === 'admin' && (
          <div className="space-y-2">
            <Label htmlFor="clinicalRole" className="text-sm font-semibold text-slate-800">
              {copy.clinicalRole}
            </Label>
            <select
              id="clinicalRole"
              value={clinicalRole}
              onChange={(e) => setClinicalRole(e.target.value as 'doctor' | 'nurse' | 'clinician' | '')}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">{copy.selectRole}</option>
              <option value="doctor">{copy.doctor}</option>
              <option value="nurse">{copy.nurse}</option>
              <option value="clinician">{copy.clinician}</option>
            </select>
            <p className="text-xs leading-5 text-slate-500">{copy.clinicalHint}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-semibold text-slate-800">
            {copy.email}
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
              {copy.password}
            </Label>
            <button type="button" className="text-sm font-medium text-sky-700 transition hover:text-sky-900">
              {copy.forgot}
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder={copy.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-2xl border-slate-200 bg-white px-12 text-base shadow-sm focus-visible:ring-sky-100"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
              aria-label={showPassword ? copy.hidePassword : copy.showPassword}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="h-12 w-full rounded-2xl bg-slate-950 text-base font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200" disabled={loading}>
          {loading ? copy.loading : copy.submit}
        </Button>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          <div className="mb-1 flex items-center gap-2 font-medium text-slate-800">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            {copy.secureTitle}
          </div>
          {copy.secureText}
        </div>

        <p className="text-center text-sm text-slate-600">
          {copy.newText}{' '}
          <Link to="/signup" className="font-semibold text-sky-700 transition hover:text-sky-900">
            {copy.create}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
