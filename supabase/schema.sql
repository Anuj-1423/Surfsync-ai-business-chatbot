create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  service text not null check (char_length(service) between 1 and 100),
  description text not null check (char_length(description) between 10 and 2000),
  budget text check (budget is null or char_length(budget) <= 100),
  timeline text check (timeline is null or char_length(timeline) <= 100),
  consent_given boolean not null check (consent_given),
  consent_timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

revoke all on table public.leads from anon, authenticated;
grant all on table public.leads to service_role;
