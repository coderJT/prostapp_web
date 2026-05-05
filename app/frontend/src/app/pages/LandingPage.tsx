import { useState } from 'react';
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

const pathways = [
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
];

const trustItems = [
  'Private patient and clinical views',
  'Clear assessment history',
  'Education that supports, not overwhelms',
  'Built for local clinical workflows',
];

const audienceCards = [
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
];

const footerSections = [
  {
    title: 'Platform',
    links: [
      { label: 'Risk assessment', href: '#how-it-works' },
      { label: 'Patient dashboard', href: '/signup' },
      { label: 'Appointments', href: '/signup' },
      { label: 'Education center', href: '/education' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Patient support', href: '#support' },
      { label: 'Clinical workflow', href: '#support' },
      { label: 'Privacy approach', href: '#privacy' },
    ],
  },
  {
    title: 'Governance',
    links: [
      { label: 'Clinical disclaimer', href: '#clinical-disclaimer' },
      { label: 'Data minimisation', href: '#privacy' },
      { label: 'Care planning', href: '#support' },
      { label: 'Responsible use', href: '#clinical-disclaimer' },
    ],
  },
];

export function LandingPage() {
  const [storedUser] = useState(() => getStoredUser());
  const appPath = getUserHomePath(storedUser);

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
              <span className="hidden text-xs text-slate-500 sm:block">Prostate risk support</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#how-it-works" className="transition hover:text-slate-950">How it works</a>
            <a href="#support" className="transition hover:text-slate-950">Support</a>
            <a href="#privacy" className="transition hover:text-slate-950">Privacy</a>
          </nav>

          <div className="flex items-center gap-2">
            {storedUser ? (
              <Button asChild className="rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-800">
                <Link to={appPath}>Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="rounded-2xl text-slate-700 hover:text-slate-950">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild className="rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-800">
                  <Link to="/signup">Create account</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-20">
        <div className="space-y-8">
          <div className="max-w-3xl space-y-6">
            <h1 className="text-5xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-6xl">
              A friendlier way to understand prostate cancer risk.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              ProstAPP helps patients and clinicians move from assessment to follow-up with clear results, simple records, and less confusion.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-12 rounded-2xl bg-slate-950 px-6 text-base font-semibold hover:bg-slate-800">
              <Link to={storedUser ? appPath : '/signup'}>
                {storedUser ? 'Open dashboard' : 'Start now'}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            {!storedUser && (
              <Button asChild variant="outline" className="h-12 rounded-2xl border-slate-200 bg-white/80 px-6 text-base font-semibold text-slate-800 hover:bg-white">
                <Link to="/login">I already have an account</Link>
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {audienceCards.map(({ icon: Icon, title, description }) => (
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
                <p className="text-sm font-semibold text-slate-950">Ready for follow-up</p>
                <p className="text-xs text-slate-500">Results saved securely</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white p-3 shadow-2xl shadow-slate-300/50">
            <img
              src={doctorImage}
              alt="Clinician reviewing health information"
              className="h-[440px] w-full rounded-[1.5rem] object-cover object-center"
            />
          </div>

          <div className="absolute -bottom-6 right-4 w-72 rounded-3xl border border-slate-100 bg-slate-950 p-5 text-white shadow-2xl shadow-slate-400/40">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-sky-100">
              <Sparkles className="h-4 w-4" />
              Guided experience
            </div>
            <p className="text-3xl font-semibold tracking-normal">3 steps</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">Assess risk, review results, and plan what comes next.</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-3xl font-semibold tracking-normal text-slate-950">Simple by design</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Every screen is built around the next useful action, so people can focus on health decisions instead of software.
            </p>
          </div>
          <Button asChild variant="outline" className="h-11 rounded-2xl border-slate-200 bg-white/80 px-5 font-semibold">
            <Link to={storedUser ? appPath : '/signup'}>
              {storedUser ? 'Open dashboard' : 'Try the flow'}
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {pathways.map(({ icon: Icon, title, description }, index) => (
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
            <h2 className="text-3xl font-semibold tracking-normal">Information without overwhelm.</h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Education, results, appointments, and messages are grouped around what users need to do next.
            </p>
          </div>
          <div id="privacy" className="grid gap-4 p-6 sm:p-8">
            {trustItems.map((item) => (
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
            {storedUser ? 'Your dashboard is ready.' : 'Ready when you are.'}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-300">
            {storedUser
              ? 'Continue with your saved assessments, appointments, results, and care planning.'
              : 'Create an account to begin a risk assessment, or sign in to continue with saved results and appointments.'}
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild className="h-12 rounded-2xl bg-white px-6 text-base font-semibold text-slate-950 hover:bg-slate-100">
              <Link to={storedUser ? appPath : '/signup'}>
                {storedUser ? 'Open dashboard' : 'Create account'}
              </Link>
            </Button>
            {!storedUser && (
              <Button asChild variant="outline" className="h-12 rounded-2xl border-white/20 bg-transparent px-6 text-base font-semibold text-white hover:bg-white/10 hover:text-white">
                <Link to="/login">Sign in</Link>
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
                A prostate cancer risk support platform for guided assessments, saved reports, appointments, and patient education.
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
                  <span>Built for digital health workflows in Malaysia</span>
                </div>
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-3">
              {footerSections.map((section) => (
                <div key={section.title}>
                  <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
                  <ul className="mt-4 space-y-3">
                    {section.links.map((link) => (
                      <li key={link.label}>
                        <a href={link.href} className="transition hover:text-slate-950">
                          {link.label}
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
                ProstAPP provides decision support for assessment preparation, education, and care planning. It does not provide a diagnosis, replace clinical judgement, or substitute for emergency or specialist medical care.
              </p>
              <p className="font-medium text-slate-600">© {new Date().getFullYear()} ProstAPP. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
