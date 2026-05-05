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
import { getPreferredLanguage, type LanguageCode } from '../lib/language';
const ADMIN_EMAIL_DOMAIN = 'monashmedical.com';

const signupCopy = {
  en: {
    shell: {
      title: 'Create your account',
      description: 'Set up a patient or clinical account in a few clear steps.',
      sideTitle: 'Start with a profile that fits your role.',
      sideDescription: 'Patients can begin assessments quickly, while clinical staff can manage appointments and care coordination from a dedicated view.',
      home: 'Home',
      reminderTitle: 'Friendly reminder',
      reminderText: 'ProstAPP supports risk assessment and care planning. It does not replace clinical diagnosis or urgent care.',
      highlights: ['Guided risk checks with clear next steps', 'Private access for patients and clinical teams', 'Designed for quick, calm daily use'],
    },
    errors: {
      required: 'Please fill in all required fields',
      mismatch: 'Passwords do not match',
      passwordLength: 'Password must be at least 8 characters long',
      terms: 'Please agree to the terms and conditions',
      role: 'Please select an admin role (doctor, nurse, or clinician)',
      invalidEmail: 'Invalid email',
      unavailable: 'Authentication backend unavailable. Set VITE_API_BASE_URL for deployed environments.',
      failed: 'Signup failed. Please try again.',
      storage: 'Could not save your login session. Please enable browser storage and try again.',
      boxTitle: 'Let’s fix this before continuing',
      toastSuccess: 'Account created successfully!',
      toastError: 'Signup failed',
    },
    accountType: 'Account type',
    patient: 'Patient',
    patientDesc: 'Risk checks and reports',
    clinical: 'Clinical team',
    clinicalDesc: 'Staff dashboard access',
    clinicalRole: 'Clinical role',
    selectRole: 'Select your role',
    doctor: 'Doctor',
    nurse: 'Nurse',
    clinician: 'Clinician',
    clinicalHintPrefix: 'Clinical accounts must use a',
    clinicalHintSuffix: 'email address.',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email address',
    phone: 'Phone number',
    optional: 'optional',
    password: 'Password',
    confirmPassword: 'Confirm password',
    passwordPlaceholder: 'At least 8 characters',
    confirmPlaceholder: 'Repeat password',
    hidePassword: 'Hide password',
    showPassword: 'Show password',
    termsTitle: 'Before you continue',
    agreePrefix: 'I agree to the',
    termsLink: 'Terms of Service',
    and: 'and',
    privacyLink: 'Privacy Policy',
    loading: 'Creating account...',
    submit: 'Create account',
    readyTitle: 'No confirmation email needed',
    readyText: 'Your account is created ready to use in this local setup.',
    existing: 'Already have an account?',
    signIn: 'Sign in',
  },
  ms: {
    shell: {
      title: 'Cipta akaun anda',
      description: 'Sediakan akaun pesakit atau klinikal dalam beberapa langkah jelas.',
      sideTitle: 'Mulakan dengan profil yang sesuai dengan peranan anda.',
      sideDescription: 'Pesakit boleh mula penilaian dengan cepat, manakala staf klinikal boleh mengurus temu janji dan koordinasi penjagaan.',
      home: 'Laman utama',
      reminderTitle: 'Peringatan mesra',
      reminderText: 'ProstAPP menyokong penilaian risiko dan perancangan penjagaan. Ia tidak menggantikan diagnosis klinikal atau rawatan segera.',
      highlights: ['Semakan risiko berpandu dengan langkah seterusnya yang jelas', 'Akses peribadi untuk pesakit dan pasukan klinikal', 'Direka untuk penggunaan harian yang cepat dan tenang'],
    },
    errors: {
      required: 'Sila isi semua medan wajib',
      mismatch: 'Kata laluan tidak sepadan',
      passwordLength: 'Kata laluan mesti sekurang-kurangnya 8 aksara',
      terms: 'Sila bersetuju dengan terma dan syarat',
      role: 'Sila pilih peranan admin (doktor, jururawat, atau klinisian)',
      invalidEmail: 'Emel tidak sah',
      unavailable: 'Backend pengesahan tidak tersedia.',
      failed: 'Pendaftaran gagal. Sila cuba lagi.',
      storage: 'Sesi log masuk tidak dapat disimpan. Sila aktifkan storan pelayar dan cuba lagi.',
      boxTitle: 'Mari betulkan ini sebelum meneruskan',
      toastSuccess: 'Akaun berjaya dicipta!',
      toastError: 'Pendaftaran gagal',
    },
    accountType: 'Jenis akaun',
    patient: 'Pesakit',
    patientDesc: 'Semakan risiko dan laporan',
    clinical: 'Pasukan klinikal',
    clinicalDesc: 'Akses papan pemuka staf',
    clinicalRole: 'Peranan klinikal',
    selectRole: 'Pilih peranan anda',
    doctor: 'Doktor',
    nurse: 'Jururawat',
    clinician: 'Klinisian',
    clinicalHintPrefix: 'Akaun klinikal mesti menggunakan alamat emel',
    clinicalHintSuffix: '.',
    firstName: 'Nama pertama',
    lastName: 'Nama akhir',
    email: 'Alamat emel',
    phone: 'Nombor telefon',
    optional: 'pilihan',
    password: 'Kata laluan',
    confirmPassword: 'Sahkan kata laluan',
    passwordPlaceholder: 'Sekurang-kurangnya 8 aksara',
    confirmPlaceholder: 'Ulang kata laluan',
    hidePassword: 'Sembunyikan kata laluan',
    showPassword: 'Tunjuk kata laluan',
    termsTitle: 'Sebelum anda teruskan',
    agreePrefix: 'Saya bersetuju dengan',
    termsLink: 'Terma Perkhidmatan',
    and: 'dan',
    privacyLink: 'Dasar Privasi',
    loading: 'Sedang mencipta akaun...',
    submit: 'Cipta akaun',
    readyTitle: 'Emel pengesahan tidak diperlukan',
    readyText: 'Akaun anda dicipta dan sedia digunakan dalam tetapan tempatan ini.',
    existing: 'Sudah ada akaun?',
    signIn: 'Log masuk',
  },
  zh: {
    shell: {
      title: '创建您的账户',
      description: '通过几个清晰步骤设置患者或临床账户。',
      sideTitle: '从适合您角色的个人资料开始。',
      sideDescription: '患者可快速开始评估，临床人员可在专属视图中管理预约和照护协调。',
      home: '主页',
      reminderTitle: '温馨提醒',
      reminderText: 'ProstAPP 支持风险评估和照护规划，但不能替代临床诊断或紧急医疗服务。',
      highlights: ['引导式风险评估和清晰下一步', '患者和临床团队的私密访问', '为快速、平静的日常使用而设计'],
    },
    errors: {
      required: '请填写所有必填字段',
      mismatch: '两次输入的密码不一致',
      passwordLength: '密码至少需要 8 个字符',
      terms: '请同意条款和条件',
      role: '请选择管理员角色（医生、护士或临床人员）',
      invalidEmail: '电子邮件无效',
      unavailable: '认证后端不可用。',
      failed: '注册失败，请重试。',
      storage: '无法保存登录会话。请启用浏览器存储后重试。',
      boxTitle: '继续前请修正以下问题',
      toastSuccess: '账户创建成功！',
      toastError: '注册失败',
    },
    accountType: '账户类型',
    patient: '患者',
    patientDesc: '风险评估和报告',
    clinical: '临床团队',
    clinicalDesc: '员工仪表板访问',
    clinicalRole: '临床角色',
    selectRole: '选择您的角色',
    doctor: '医生',
    nurse: '护士',
    clinician: '临床人员',
    clinicalHintPrefix: '临床账户必须使用',
    clinicalHintSuffix: '电子邮件地址。',
    firstName: '名字',
    lastName: '姓氏',
    email: '电子邮件地址',
    phone: '电话号码',
    optional: '选填',
    password: '密码',
    confirmPassword: '确认密码',
    passwordPlaceholder: '至少 8 个字符',
    confirmPlaceholder: '再次输入密码',
    hidePassword: '隐藏密码',
    showPassword: '显示密码',
    termsTitle: '继续前',
    agreePrefix: '我同意',
    termsLink: '服务条款',
    and: '和',
    privacyLink: '隐私政策',
    loading: '正在创建账户...',
    submit: '创建账户',
    readyTitle: '无需确认邮件',
    readyText: '您的账户已创建，可在此本地设置中直接使用。',
    existing: '已经有账户？',
    signIn: '登录',
  },
} as const;

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
  const [language, setLanguage] = useState<LanguageCode>(() => getPreferredLanguage());
  const copy = signupCopy[language];

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
        setError(copy.errors.required);
        setLoading(false);
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError(copy.errors.mismatch);
        setLoading(false);
        return;
      }

      if (formData.password.length < 8) {
        setError(copy.errors.passwordLength);
        setLoading(false);
        return;
      }

      if (!agreedToTerms) {
        setError(copy.errors.terms);
        setLoading(false);
        return;
      }

      if (accountType === 'admin' && !clinicalRole) {
        setError(copy.errors.role);
        setLoading(false);
        return;
      }

      const normalizedEmail = formData.email.trim().toLowerCase();

      if (accountType === 'admin' && !normalizedEmail.endsWith(`@${ADMIN_EMAIL_DOMAIN}`)) {
        setError(copy.errors.invalidEmail);
        setLoading(false);
        return;
      }

      const signupUrl = buildApiUrl('/api/auth/signup');
      if (!signupUrl) {
        throw new Error(copy.errors.unavailable);
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
        throw new Error(payload?.error || copy.errors.failed);
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
      <form onSubmit={handleSignup} className="space-y-5">
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
          <Label className="text-sm font-semibold text-slate-800">{copy.accountType}</Label>
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
          <div className="space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <Label htmlFor="adminRole" className="text-sm font-semibold text-slate-800">
              {copy.clinicalRole}
            </Label>
            <select
              id="adminRole"
              value={clinicalRole}
              onChange={(e) => setClinicalRole(e.target.value as 'doctor' | 'nurse' | 'clinician' | '')}
              className="h-12 w-full rounded-2xl border border-emerald-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">{copy.selectRole}</option>
              <option value="doctor">{copy.doctor}</option>
              <option value="nurse">{copy.nurse}</option>
              <option value="clinician">{copy.clinician}</option>
            </select>
            <p className="text-xs leading-5 text-emerald-800">{copy.clinicalHintPrefix} @{ADMIN_EMAIL_DOMAIN} {copy.clinicalHintSuffix}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-sm font-semibold text-slate-800">
              {copy.firstName}
            </Label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="firstName"
                name="firstName"
                type="text"
                placeholder={copy.firstName}
                value={formData.firstName}
                onChange={handleChange}
                className="h-12 rounded-2xl border-slate-200 bg-white pl-12 text-base shadow-sm focus-visible:ring-sky-100"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-sm font-semibold text-slate-800">
              {copy.lastName}
            </Label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="lastName"
                name="lastName"
                type="text"
                placeholder={copy.lastName}
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
            {copy.email}
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
            {copy.phone} <span className="font-normal text-slate-400">{copy.optional}</span>
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
              {copy.password}
            </Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={copy.passwordPlaceholder}
                value={formData.password}
                onChange={handleChange}
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

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-800">
              {copy.confirmPassword}
            </Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder={copy.confirmPlaceholder}
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
            {copy.termsTitle}
          </div>
          <label htmlFor="terms" className="flex cursor-pointer items-start gap-3 leading-6">
            <Checkbox
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              className="mt-1"
            />
            <span>
              {copy.agreePrefix}{' '}
              <a href="#" className="font-medium text-sky-700 hover:text-sky-900">
                {copy.termsLink}
              </a>{' '}
              {copy.and}{' '}
              <a href="#" className="font-medium text-sky-700 hover:text-sky-900">
                {copy.privacyLink}
              </a>
            </span>
          </label>
        </div>

        <Button type="submit" className="h-12 w-full rounded-2xl bg-slate-950 text-base font-semibold hover:bg-slate-800" disabled={loading}>
          {loading ? copy.loading : copy.submit}
        </Button>

        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4" />
            {copy.readyTitle}
          </div>
          {copy.readyText}
        </div>

        <p className="text-center text-sm text-slate-600">
          {copy.existing}{' '}
          <Link to="/login" className="font-semibold text-sky-700 transition hover:text-sky-900">
            {copy.signIn}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
