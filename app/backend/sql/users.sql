create sequence if not exists public.patient_user_id_seq;
create sequence if not exists public.clinician_user_id_seq;

create or replace function public.generate_user_id()
returns trigger
language plpgsql
as $$
begin
    if new.id is not null and length(trim(new.id)) > 0 then
        return new;
    end if;

    if coalesce(new.is_clinician, false) then
        new.id := 'C' || lpad(nextval('public.clinician_user_id_seq')::text, 4, '0');
    else
        new.id := 'P' || lpad(nextval('public.patient_user_id_seq')::text, 4, '0');
    end if;

    return new;
end;
$$;

create table if not exists public.users (
    id text primary key not null,
    created_at timestamptz not null default now(),
    user_first_name text not null,
    user_last_name text not null,
    user_email text not null unique,
    user_hashed_password varchar not null,
    user_phone_number varchar not null,
    is_clinician boolean not null default false
);

alter table public.users
    add column if not exists avatar_url text,
    add column if not exists date_of_birth date,
    add column if not exists address text,
    add column if not exists city text,
    add column if not exists state text,
    add column if not exists zip_code text,
    add column if not exists notification_preferences jsonb not null default '{
        "emailNotifications": true,
        "smsNotifications": false,
        "appointmentReminders": true,
        "assessmentReminders": true,
        "educationalContent": true
    }'::jsonb,
    add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_users_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists users_generate_id on public.users;

create trigger users_generate_id
before insert on public.users
for each row
execute function public.generate_user_id();

drop trigger if exists users_set_updated_at on public.users;

create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_users_updated_at();

comment on column public.users.avatar_url is
'Base64 or URL avatar image shown in the profile header.';

comment on column public.users.date_of_birth is
'Patient date of birth saved from Profile Settings.';

comment on column public.users.address is
'Street address saved from Profile Settings.';

comment on column public.users.city is
'City saved from Profile Settings.';

comment on column public.users.state is
'State saved from Profile Settings.';

comment on column public.users.zip_code is
'Postal or ZIP code saved from Profile Settings.';

comment on column public.users.notification_preferences is
'JSON object of Profile Settings notification toggles.';

insert into public.users (
    user_first_name,
    user_last_name,
    user_email,
    user_hashed_password,
    user_phone_number,
    is_clinician
)
values
    ('John', 'Doe', 'john.doe@example.com', '$2b$10$replace_with_real_hash', '0123456789', false),
    ('Sarah', 'Smith', 'sarah.smith@example.com', '$2b$10$replace_with_real_hash', '0987654321', true)
on conflict (user_email) do nothing;
