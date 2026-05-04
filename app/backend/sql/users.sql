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

drop trigger if exists users_generate_id on public.users;

create trigger users_generate_id
before insert on public.users
for each row
execute function public.generate_user_id();

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
