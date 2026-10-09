-- MetaLink Logistique: secure chat and advertising requests
-- Review this migration, then run it manually in Supabase SQL Editor.
-- It does not change the existing public.annonces table or its policies.

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  participant_one uuid not null references auth.users(id) on delete cascade,
  participant_two uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  context text not null default 'transport',
  created_at timestamptz not null default now(),
  constraint chat_distinct_participants check (participant_one <> participant_two),
  constraint chat_participant_order check (participant_one < participant_two),
  constraint chat_context_length check (char_length(context) <= 300)
);

create unique index if not exists chat_conversations_pair_context_unique
  on public.chat_conversations (participant_one, participant_two, context);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint chat_message_body_length check (char_length(trim(body)) between 1 and 4000)
);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at);

create table if not exists public.ad_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_name text not null,
  ad_type text not null,
  requested_style text not null,
  brief text not null,
  contact_details text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_company_length check (char_length(trim(company_name)) between 1 and 160),
  constraint ad_type_length check (char_length(trim(ad_type)) between 1 and 100),
  constraint ad_style_length check (char_length(trim(requested_style)) between 1 and 100),
  constraint ad_brief_length check (char_length(trim(brief)) between 1 and 3000),
  constraint ad_contact_length check (char_length(trim(contact_details)) between 1 and 300),
  constraint ad_status_allowed check (status in ('pending', 'reviewing', 'approved', 'rejected', 'published'))
);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.ad_requests enable row level security;

drop policy if exists "Conversation participants can read conversations" on public.chat_conversations;
create policy "Conversation participants can read conversations"
on public.chat_conversations for select to authenticated
using (auth.uid() = participant_one or auth.uid() = participant_two);

drop policy if exists "Users can create conversations they participate in" on public.chat_conversations;
create policy "Users can create conversations they participate in"
on public.chat_conversations for insert to authenticated
with check (
  auth.uid() = created_by
  and (auth.uid() = participant_one or auth.uid() = participant_two)
);

drop policy if exists "Conversation participants can read messages" on public.chat_messages;
create policy "Conversation participants can read messages"
on public.chat_messages for select to authenticated
using (
  exists (
    select 1 from public.chat_conversations c
    where c.id = conversation_id
      and (c.participant_one = auth.uid() or c.participant_two = auth.uid())
  )
);

drop policy if exists "Participants can send messages as themselves" on public.chat_messages;
create policy "Participants can send messages as themselves"
on public.chat_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.chat_conversations c
    where c.id = conversation_id
      and (c.participant_one = auth.uid() or c.participant_two = auth.uid())
  )
);

drop policy if exists "Users can read their own ad requests" on public.ad_requests;
create policy "Users can read their own ad requests"
on public.ad_requests for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can submit their own ad requests" on public.ad_requests;
create policy "Users can submit their own ad requests"
on public.ad_requests for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update their own pending ad requests" on public.ad_requests;
create policy "Users can update their own pending ad requests"
on public.ad_requests for update to authenticated
using (user_id = auth.uid() and status = 'pending')
with check (user_id = auth.uid() and status = 'pending');

grant select, insert on public.chat_conversations to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select, insert, update on public.ad_requests to authenticated;
