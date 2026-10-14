-- Run after schema.sql in the SurfSync Supabase SQL editor.
-- Team members must first be created in Authentication > Users, then added to team_agents.

create table if not exists public.team_agents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  active boolean not null default true,
  online_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.customer_queries (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  conversation_id uuid not null,
  question text not null check (char_length(question) between 1 and 2000),
  answer text not null check (char_length(answer) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists customer_queries_history_idx on public.customer_queries(customer_id, created_at desc);
create index if not exists customer_queries_conversation_idx on public.customer_queries(conversation_id, created_at);

create table if not exists public.live_chats (
  id uuid primary key default gen_random_uuid(),
  visitor_token_hash text not null unique check (char_length(visitor_token_hash) = 64),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'closed')),
  assigned_agent uuid references public.team_agents(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.live_chats add column if not exists customer_id uuid references public.customer_profiles(user_id) on delete cascade;
alter table public.live_chats add column if not exists customer_name text not null default 'Website visitor';

create table if not exists public.live_chat_messages (
  id bigint generated always as identity primary key,
  chat_id uuid not null references public.live_chats(id) on delete cascade,
  sender_role text not null check (sender_role in ('visitor', 'assistant', 'agent', 'system')),
  sender_id uuid references public.team_agents(user_id) on delete set null,
  sender_name text not null check (char_length(sender_name) between 1 and 100),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists live_chats_queue_idx on public.live_chats(status, created_at);
create index if not exists live_chats_agent_idx on public.live_chats(assigned_agent, status, updated_at desc);
create index if not exists live_chat_messages_thread_idx on public.live_chat_messages(chat_id, created_at);

alter table public.team_agents enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.customer_queries enable row level security;
alter table public.live_chats enable row level security;
alter table public.live_chat_messages enable row level security;

revoke all on public.team_agents, public.customer_profiles, public.customer_queries, public.live_chats, public.live_chat_messages from anon, authenticated;
grant all on public.team_agents, public.customer_profiles, public.customer_queries, public.live_chats, public.live_chat_messages to service_role;
revoke all on sequence public.live_chat_messages_id_seq from anon, authenticated;
grant usage, select on sequence public.live_chat_messages_id_seq to service_role;
revoke all on sequence public.customer_queries_id_seq from anon, authenticated;
grant usage, select on sequence public.customer_queries_id_seq to service_role;

comment on table public.team_agents is 'Only active agents can access the staff dashboard; online_until is refreshed by the authenticated staff panel.';
comment on table public.customer_profiles is 'Customer names for authenticated visitor accounts. Accessed through server routes only.';
comment on table public.customer_queries is 'Authenticated customer chatbot questions and answers, visible to enabled staff through server routes.';
comment on table public.live_chats is 'Handoff sessions. Visitor access is validated through a hashed random token in server routes.';
comment on table public.live_chat_messages is 'Chat transcript is available only through authorized server routes.';
