import { Link } from 'react-router';
import { Activity, ArrowLeft, CheckCircle2, HeartPulse, ShieldCheck, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

type AuthShellProps = {
  title: string;
  description: string;
  sideTitle: string;
  sideDescription: string;
  children: ReactNode;
};

const highlights = [
  { icon: HeartPulse, text: 'Guided risk checks with clear next steps' },
  { icon: ShieldCheck, text: 'Private access for patients and clinical teams' },
  { icon: Sparkles, text: 'Designed for quick, calm daily use' },
];

export function AuthShell({ title, description, sideTitle, sideDescription, children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e0f2fe_0,_transparent_34%),linear-gradient(135deg,_#f8fafc_0%,_#eef6ff_48%,_#f7fbf8_100%)] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="hidden h-full min-h-[640px] flex-col justify-between overflow-hidden rounded-3xl bg-slate-950 p-8 text-white shadow-2xl shadow-slate-200/70 lg:flex">
          <div>
            <Link to="/" className="inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/15">
              <Activity className="h-5 w-5 text-sky-300" />
              ProstAPP
            </Link>
          </div>

          <div className="space-y-7">
            <div className="max-w-md space-y-4">
              <h1 className="text-5xl font-semibold leading-tight tracking-normal text-white">{sideTitle}</h1>
              <p className="text-lg leading-8 text-slate-300">{sideDescription}</p>
            </div>

            <div className="space-y-3">
              {highlights.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/7 px-4 py-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-400/15 text-sky-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium text-slate-100">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-50">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Friendly reminder
            </div>
            ProstAPP supports risk assessment and care planning. It does not replace clinical diagnosis or urgent care.
          </div>
        </section>

        <section className="mx-auto w-full max-w-xl">
          <div className="mb-6 flex items-center justify-between">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
            <Link to="/" className="inline-flex items-center gap-2 font-semibold text-slate-950 lg:hidden">
              <Activity className="h-6 w-6 text-sky-600" />
              ProstAPP
            </Link>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-2xl shadow-slate-200/80 backdrop-blur sm:p-8">
            <div className="mb-7 space-y-2">
              <h2 className="text-3xl font-semibold tracking-normal text-slate-950">{title}</h2>
              <p className="text-sm leading-6 text-slate-600">{description}</p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
