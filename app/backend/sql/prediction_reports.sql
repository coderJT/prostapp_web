create table if not exists public.prediction_reports (
    id uuid primary key default gen_random_uuid(),
    client_entry_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    user_id text references public.users(id) on delete set null,
    user_email text not null,

    source text not null check (source in ('form', 'ml-invasive', 'ml-ftir')),
    csv_type text check (csv_type in ('invasive', 'ftir')),

    risk_level text not null check (risk_level in ('Low', 'Moderate', 'High')),
    risk_score integer not null check (risk_score >= 0 and risk_score <= 100),
    color text not null check (color in ('green', 'yellow', 'red')),

    prediction_value numeric(8, 6),
    prediction_class text,
    csv_file_name text,

    lime_summary text,
    shap_summary text,

    top_lime_features jsonb not null default '[]'::jsonb,
    top_shap_features jsonb not null default '[]'::jsonb,
    feature_notes jsonb not null default '[]'::jsonb,
    ftir_spectrum_data jsonb not null default '[]'::jsonb
);

alter table public.prediction_reports
    add column if not exists ftir_spectrum_data jsonb not null default '[]'::jsonb;

create index if not exists prediction_reports_user_email_idx
    on public.prediction_reports (user_email);

create unique index if not exists prediction_reports_client_entry_id_idx
    on public.prediction_reports (client_entry_id)
    where client_entry_id is not null;

create index if not exists prediction_reports_user_id_idx
    on public.prediction_reports (user_id);

create index if not exists prediction_reports_created_at_idx
    on public.prediction_reports (created_at desc);

create index if not exists prediction_reports_source_idx
    on public.prediction_reports (source);

create or replace function public.set_prediction_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists prediction_reports_set_updated_at on public.prediction_reports;

create trigger prediction_reports_set_updated_at
before update on public.prediction_reports
for each row
execute function public.set_prediction_reports_updated_at();

comment on table public.prediction_reports is
'Stores manual assessments and model-based prediction reports, including LIME/SHAP explanation payloads.';

comment on column public.prediction_reports.top_lime_features is
'JSON array of patient-specific explanation features as returned by the frontend/backend pipeline.';

comment on column public.prediction_reports.top_shap_features is
'JSON array of model-wide SHAP features as returned by the frontend/backend pipeline.';

comment on column public.prediction_reports.feature_notes is
'JSON array of plain-language feature interpretation notes used in the report view.';

comment on column public.prediction_reports.ftir_spectrum_data is
'Downsampled raw FTIR spectrum points used to render the saved non-invasive report graph.';
