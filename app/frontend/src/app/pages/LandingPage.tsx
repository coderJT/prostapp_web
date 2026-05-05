import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HeartPulse,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import doctorImage from '../../../img/doctor-tablet.webp';
import { getStoredUser, getUserHomePath } from '../auth/session';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { getPreferredLanguage, type LanguageCode } from '../lib/language';

const pageCopy = {
  en: {
    tagline: 'Prostate risk support',
    nav: ['How it works', 'Support', 'Privacy'],
    signIn: 'Sign in',
    createAccount: 'Create account',
    openDashboard: 'Open dashboard',
    heroTitle: 'A friendlier way to understand prostate cancer risk.',
    heroMessages: [
      'A friendlier way to understand prostate cancer risk.',
      'Clear assessments for patients and clinical teams.',
      'Local decision support built for Malaysian care workflows.',
    ],
    heroDescription: 'ProstAPP helps patients and clinicians move from assessment to follow-up with clear results, simple records, and less confusion.',
    startNow: 'Start now',
    existingAccount: 'I already have an account',
    audienceCards: [
      {
        icon: HeartPulse,
        title: 'For patients',
        description: 'A calm path to understand risk, save results, and prepare better questions for care teams.',
      },
      {
        icon: Stethoscope,
        title: 'For clinical teams',
        description: 'A focused workspace for reviewing activity, appointments, and patient-facing next steps.',
      },
    ],
    readyTitle: 'Ready for follow-up',
    readySubtitle: 'Results saved securely',
    guidedTitle: 'Guided experience',
    stepsCount: '3 steps',
    stepsDescription: 'Assess risk, review results, and plan what comes next.',
    howTitle: 'Simple by design',
    howDescription: 'Every screen is built around the next useful action, so people can focus on health decisions instead of software.',
    tryFlow: 'Try the flow',
    pathways: [
      {
        icon: ClipboardCheck,
        title: 'Start a risk check',
        description: 'Answer guided questions or upload clinical data when you are ready.',
      },
      {
        icon: FileText,
        title: 'Review plain-language results',
        description: 'See your risk summary, model insight, and assessment history in one place.',
      },
      {
        icon: CalendarDays,
        title: 'Coordinate follow-up care',
        description: 'Book appointments and keep important care messages close by.',
      },
    ],
    supportTitle: 'Information without overwhelm.',
    supportDescription: 'Education, results, appointments, and messages are grouped around what users need to do next.',
    trustItems: [
      'Private patient and clinical views',
      'Clear assessment history',
      'Education that supports, not overwhelms',
      'Trained on a broad hospital-sourced Malaysian dataset for local decision-support context',
      'Built for local clinical workflows',
    ],
    ctaReady: 'Ready when you are.',
    ctaDashboardReady: 'Your dashboard is ready.',
    ctaDescription: 'Create an account to begin a risk assessment, or sign in to continue with saved results and appointments.',
    ctaDashboardDescription: 'Continue with your saved assessments, appointments, results, and care planning.',
    footerDescription: 'A prostate cancer risk support platform for guided assessments, saved reports, appointments, and patient education.',
    location: 'Built for digital health workflows in Malaysia',
    footerSections: [
      {
        title: 'Platform',
        links: ['Risk assessment', 'Patient dashboard', 'Appointments', 'Education center'],
      },
      {
        title: 'Support',
        links: ['How it works', 'Patient support', 'Clinical workflow', 'Privacy approach'],
      },
      {
        title: 'Governance',
        links: ['Clinical disclaimer', 'Data minimisation', 'Care planning', 'Responsible use'],
      },
    ],
    disclaimer: 'ProstAPP provides decision support for assessment preparation, education, and care planning. It does not provide a diagnosis, replace clinical judgement, or substitute for emergency or specialist medical care.',
    rights: 'All rights reserved.',
    imageAlt: 'Clinician reviewing health information',
  },
  ms: {
    tagline: 'Sokongan risiko prostat',
    nav: ['Cara ia berfungsi', 'Sokongan', 'Privasi'],
    signIn: 'Log masuk',
    createAccount: 'Cipta akaun',
    openDashboard: 'Buka papan pemuka',
    heroTitle: 'Cara yang lebih mesra untuk memahami risiko kanser prostat.',
    heroMessages: [
      'Cara yang lebih mesra untuk memahami risiko kanser prostat.',
      'Penilaian jelas untuk pesakit dan pasukan klinikal.',
      'Sokongan keputusan tempatan untuk aliran penjagaan di Malaysia.',
    ],
    heroDescription: 'ProstAPP membantu pesakit dan klinisian bergerak daripada penilaian kepada susulan dengan keputusan yang jelas, rekod ringkas, dan kurang kekeliruan.',
    startNow: 'Mula sekarang',
    existingAccount: 'Saya sudah ada akaun',
    audienceCards: [
      {
        icon: HeartPulse,
        title: 'Untuk pesakit',
        description: 'Laluan yang tenang untuk memahami risiko, menyimpan keputusan, dan menyediakan soalan yang lebih baik untuk pasukan penjagaan.',
      },
      {
        icon: Stethoscope,
        title: 'Untuk pasukan klinikal',
        description: 'Ruang kerja berfokus untuk menyemak aktiviti, temu janji, dan langkah susulan pesakit.',
      },
    ],
    readyTitle: 'Sedia untuk susulan',
    readySubtitle: 'Keputusan disimpan dengan selamat',
    guidedTitle: 'Pengalaman berpandu',
    stepsCount: '3 langkah',
    stepsDescription: 'Nilai risiko, semak keputusan, dan rancang tindakan seterusnya.',
    howTitle: 'Ringkas secara reka bentuk',
    howDescription: 'Setiap skrin dibina berdasarkan tindakan berguna seterusnya supaya pengguna boleh fokus pada keputusan kesihatan, bukan perisian.',
    tryFlow: 'Cuba aliran',
    pathways: [
      {
        icon: ClipboardCheck,
        title: 'Mulakan semakan risiko',
        description: 'Jawab soalan berpandu atau muat naik data klinikal apabila anda bersedia.',
      },
      {
        icon: FileText,
        title: 'Semak keputusan bahasa mudah',
        description: 'Lihat ringkasan risiko, pandangan model, dan sejarah penilaian di satu tempat.',
      },
      {
        icon: CalendarDays,
        title: 'Selaras penjagaan susulan',
        description: 'Tempah temu janji dan simpan mesej penjagaan penting berdekatan.',
      },
    ],
    supportTitle: 'Maklumat tanpa membebankan.',
    supportDescription: 'Pendidikan, keputusan, temu janji, dan mesej dikumpulkan mengikut perkara yang perlu dilakukan seterusnya.',
    trustItems: [
      'Paparan peribadi untuk pesakit dan klinikal',
      'Sejarah penilaian yang jelas',
      'Pendidikan yang membantu tanpa membebankan',
      'Dilatih menggunakan dataset luas daripada hospital di Malaysia untuk konteks sokongan keputusan tempatan',
      'Dibina untuk aliran kerja klinikal tempatan',
    ],
    ctaReady: 'Sedia apabila anda bersedia.',
    ctaDashboardReady: 'Papan pemuka anda sudah sedia.',
    ctaDescription: 'Cipta akaun untuk memulakan penilaian risiko, atau log masuk untuk meneruskan keputusan dan temu janji yang disimpan.',
    ctaDashboardDescription: 'Teruskan dengan penilaian, temu janji, keputusan, dan perancangan penjagaan yang disimpan.',
    footerDescription: 'Platform sokongan risiko kanser prostat untuk penilaian berpandu, laporan tersimpan, temu janji, dan pendidikan pesakit.',
    location: 'Dibina untuk aliran kerja kesihatan digital di Malaysia',
    footerSections: [
      {
        title: 'Platform',
        links: ['Penilaian risiko', 'Papan pemuka pesakit', 'Temu janji', 'Pusat pendidikan'],
      },
      {
        title: 'Sokongan',
        links: ['Cara ia berfungsi', 'Sokongan pesakit', 'Aliran kerja klinikal', 'Pendekatan privasi'],
      },
      {
        title: 'Tadbir urus',
        links: ['Penafian klinikal', 'Pengurangan data', 'Perancangan penjagaan', 'Penggunaan bertanggungjawab'],
      },
    ],
    disclaimer: 'ProstAPP menyediakan sokongan keputusan untuk persediaan penilaian, pendidikan, dan perancangan penjagaan. Ia tidak memberikan diagnosis, menggantikan pertimbangan klinikal, atau menggantikan rawatan kecemasan atau pakar.',
    rights: 'Hak cipta terpelihara.',
    imageAlt: 'Klinisian menyemak maklumat kesihatan',
  },
  zh: {
    tagline: '前列腺风险支持',
    nav: ['运作方式', '支持', '隐私'],
    signIn: '登录',
    createAccount: '创建账户',
    openDashboard: '打开仪表板',
    heroTitle: '更友好地了解前列腺癌风险。',
    heroMessages: [
      '更友好地了解前列腺癌风险。',
      '为患者和临床团队提供清晰评估。',
      '为马来西亚照护流程而设计的本地决策支持。',
    ],
    heroDescription: 'ProstAPP 帮助患者和临床团队从评估走向随访，以清晰结果、简洁记录和更少困惑支持照护。',
    startNow: '立即开始',
    existingAccount: '我已有账户',
    audienceCards: [
      {
        icon: HeartPulse,
        title: '面向患者',
        description: '以平静清晰的方式了解风险、保存结果，并为与医疗团队沟通准备更好的问题。',
      },
      {
        icon: Stethoscope,
        title: '面向临床团队',
        description: '集中查看活动、预约和患者下一步照护安排的工作空间。',
      },
    ],
    readyTitle: '已准备好随访',
    readySubtitle: '结果已安全保存',
    guidedTitle: '引导式体验',
    stepsCount: '3 步',
    stepsDescription: '评估风险、查看结果，并规划下一步。',
    howTitle: '以简洁为核心',
    howDescription: '每个页面都围绕下一步有用操作设计，让用户专注于健康决策，而不是软件本身。',
    tryFlow: '体验流程',
    pathways: [
      {
        icon: ClipboardCheck,
        title: '开始风险评估',
        description: '准备好时，可回答引导问题或上传临床数据。',
      },
      {
        icon: FileText,
        title: '查看易懂结果',
        description: '在同一处查看风险摘要、模型解释和评估历史。',
      },
      {
        icon: CalendarDays,
        title: '协调后续照护',
        description: '预约就诊，并保留重要照护信息。',
      },
    ],
    supportTitle: '信息清楚，不造成负担。',
    supportDescription: '教育内容、结果、预约和消息会根据用户下一步需要整理。',
    trustItems: [
      '患者与临床视图分开保护',
      '清晰的评估历史',
      '有帮助且不过载的教育内容',
      '模型使用来自马来西亚医院的广泛数据集训练，以支持本地决策情境',
      '为本地临床工作流程而设计',
    ],
    ctaReady: '随时可以开始。',
    ctaDashboardReady: '您的仪表板已准备好。',
    ctaDescription: '创建账户以开始风险评估，或登录继续查看已保存的结果和预约。',
    ctaDashboardDescription: '继续查看已保存的评估、预约、结果和照护计划。',
    footerDescription: '前列腺癌风险支持平台，提供引导式评估、报告保存、预约和患者教育。',
    location: '为马来西亚数字健康工作流程而设计',
    footerSections: [
      {
        title: '平台',
        links: ['风险评估', '患者仪表板', '预约', '教育中心'],
      },
      {
        title: '支持',
        links: ['运作方式', '患者支持', '临床工作流程', '隐私方式'],
      },
      {
        title: '治理',
        links: ['临床免责声明', '数据最小化', '照护规划', '负责任使用'],
      },
    ],
    disclaimer: 'ProstAPP 提供评估准备、教育和照护规划方面的决策支持。它不提供诊断，也不能替代临床判断、急诊或专科医疗服务。',
    rights: '版权所有。',
    imageAlt: '临床人员正在查看健康信息',
  },
} as const;

const footerLinkTargets = [
  ['#how-it-works', '/signup', '/signup', '/education'],
  ['#how-it-works', '#support', '#support', '#privacy'],
  ['#clinical-disclaimer', '#privacy', '#support', '#clinical-disclaimer'],
];

export function LandingPage() {
  const [storedUser] = useState(() => getStoredUser());
  const [language, setLanguage] = useState<LanguageCode>(() => getPreferredLanguage());
  const [headlineLanguageIndex, setHeadlineLanguageIndex] = useState(0);
  const appPath = getUserHomePath(storedUser);
  const copy = pageCopy[language];
  const headlineCopy = copy.heroMessages[headlineLanguageIndex];

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<LanguageCode>).detail;
      if (nextLanguage) {
        setLanguage(nextLanguage);
        setHeadlineLanguageIndex(0);
      }
    };

    window.addEventListener('prostapp-language-change', handleLanguageChange);
    return () => window.removeEventListener('prostapp-language-change', handleLanguageChange);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setHeadlineLanguageIndex((currentIndex) => (currentIndex + 1) % pageCopy.en.heroMessages.length);
    }, 3200);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e0f2fe_0,_transparent_34%),linear-gradient(135deg,_#f8fafc_0%,_#eef6ff_48%,_#f7fbf8_100%)] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-white/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to={storedUser ? appPath : '/'} className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sky-200 shadow-lg shadow-slate-200">
              <Activity className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-lg font-semibold leading-5 tracking-normal">ProstAPP</span>
              <span className="hidden text-xs text-slate-500 sm:block">{copy.tagline}</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#how-it-works" className="transition hover:text-slate-950">{copy.nav[0]}</a>
            <a href="#support" className="transition hover:text-slate-950">{copy.nav[1]}</a>
            <a href="#privacy" className="transition hover:text-slate-950">{copy.nav[2]}</a>
          </nav>

          <div className="flex items-center gap-2">
            {storedUser ? (
              <Button asChild className="rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-800">
                <Link to={appPath}>{copy.openDashboard}</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="rounded-2xl text-slate-700 hover:text-slate-950">
                  <Link to="/login">{copy.signIn}</Link>
                </Button>
                <Button asChild className="rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-800">
                  <Link to="/signup">{copy.createAccount}</Link>
                </Button>
              </>
            )}
            <LanguageSwitcher className="hidden shrink-0 md:flex" />
          </div>
        </div>
        <div className="border-t border-slate-100 px-4 py-2 md:hidden">
          <div className="mx-auto flex max-w-6xl justify-end">
            <LanguageSwitcher size="md" />
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-20">
        <div className="space-y-8">
          <div className="max-w-3xl space-y-6">
            <h1 className="min-h-[11.25rem] overflow-hidden text-5xl font-semibold leading-tight tracking-normal text-slate-950 sm:min-h-[9rem] sm:text-6xl lg:min-h-[13.5rem]">
              <span
                key={`${language}-${headlineLanguageIndex}`}
                className="block animate-in fade-in slide-in-from-left-6 duration-700"
              >
                {headlineCopy}
              </span>
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              {copy.heroDescription}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-12 rounded-2xl bg-slate-950 px-6 text-base font-semibold hover:bg-slate-800">
              <Link to={storedUser ? appPath : '/signup'}>
                {storedUser ? copy.openDashboard : copy.startNow}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            {!storedUser && (
              <Button asChild variant="outline" className="h-12 rounded-2xl border-slate-200 bg-white/80 px-6 text-base font-semibold text-slate-800 hover:bg-white">
                <Link to="/login">{copy.existingAccount}</Link>
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {copy.audienceCards.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-xl shadow-slate-200/60 backdrop-blur">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-base font-semibold text-slate-950">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-6 top-8 hidden rounded-3xl border border-white/80 bg-white/85 p-4 shadow-2xl shadow-slate-300/40 backdrop-blur md:block">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-950">{copy.readyTitle}</p>
                <p className="text-xs text-slate-500">{copy.readySubtitle}</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white p-3 shadow-2xl shadow-slate-300/50">
            <img
              src={doctorImage}
              alt={copy.imageAlt}
              className="h-[440px] w-full rounded-[1.5rem] object-cover object-center"
            />
          </div>

          <div className="absolute -bottom-6 right-4 w-72 rounded-3xl border border-slate-100 bg-slate-950 p-5 text-white shadow-2xl shadow-slate-400/40">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-sky-100">
              <Sparkles className="h-4 w-4" />
              {copy.guidedTitle}
            </div>
            <p className="text-3xl font-semibold tracking-normal">{copy.stepsCount}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{copy.stepsDescription}</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-3xl font-semibold tracking-normal text-slate-950">{copy.howTitle}</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              {copy.howDescription}
            </p>
          </div>
          <Button asChild variant="outline" className="h-11 rounded-2xl border-slate-200 bg-white/80 px-5 font-semibold">
            <Link to={storedUser ? appPath : '/signup'}>
              {storedUser ? copy.openDashboard : copy.tryFlow}
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {copy.pathways.map(({ icon: Icon, title, description }, index) => (
            <article key={title} className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-xl shadow-slate-200/60">
              <div className="mb-6 flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="text-sm font-semibold text-slate-300">0{index + 1}</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="support" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 shadow-2xl shadow-slate-200/70 md:grid-cols-[0.85fr_1.15fr]">
          <div className="bg-slate-950 p-8 text-white sm:p-10">
            <BookOpen className="mb-6 h-10 w-10 text-sky-300" />
            <h2 className="text-3xl font-semibold tracking-normal">{copy.supportTitle}</h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              {copy.supportDescription}
            </p>
          </div>
          <div id="privacy" className="grid gap-4 p-6 sm:p-8">
            {copy.trustItems.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
                <p className="text-sm font-medium leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-slate-950 px-6 py-10 text-center text-white shadow-2xl shadow-slate-300/50 sm:px-10">
          <h2 className="text-3xl font-semibold tracking-normal">
            {storedUser ? copy.ctaDashboardReady : copy.ctaReady}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-300">
            {storedUser
              ? copy.ctaDashboardDescription
              : copy.ctaDescription}
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild className="h-12 rounded-2xl bg-white px-6 text-base font-semibold text-slate-950 hover:bg-slate-100">
              <Link to={storedUser ? appPath : '/signup'}>
                {storedUser ? copy.openDashboard : copy.createAccount}
              </Link>
            </Button>
            {!storedUser && (
              <Button asChild variant="outline" className="h-12 rounded-2xl border-white/20 bg-transparent px-6 text-base font-semibold text-white hover:bg-white/10 hover:text-white">
                <Link to="/login">{copy.signIn}</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/70 bg-white/80">
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-500 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-[1.35fr_2fr]">
            <div>
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Activity className="h-5 w-5 text-sky-600" />
                ProstAPP
              </div>
              <p className="mt-4 max-w-sm leading-6">
                {copy.footerDescription}
              </p>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <a href="mailto:support@prostapp.health" className="font-medium text-slate-700 transition hover:text-slate-950">
                    support@prostapp.health
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span>{copy.location}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-3">
              {copy.footerSections.map((section, sectionIndex) => (
                <div key={section.title}>
                  <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
                  <ul className="mt-4 space-y-3">
                    {section.links.map((label, linkIndex) => (
                      <li key={label}>
                        <a href={footerLinkTargets[sectionIndex][linkIndex]} className="transition hover:text-slate-950">
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div id="clinical-disclaimer" className="mt-10 border-t border-slate-200/70 pt-6">
            <div className="grid gap-4 text-xs leading-5 text-slate-500 md:grid-cols-[1fr_auto] md:items-end">
              <p className="max-w-3xl">
                {copy.disclaimer}
              </p>
              <p className="font-medium text-slate-600">© {new Date().getFullYear()} ProstAPP. {copy.rights}</p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
