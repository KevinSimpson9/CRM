-- IR CRM — initial schema
-- Single-user CRM. RLS is enabled on every table; the sole authenticated user
-- gets full access. The MCP server and cron jobs use the service-role key.

create extension if not exists pg_trgm;

-- Supabase may have pg_trgm pre-installed in its "extensions" schema, where
-- unqualified gin_trgm_ops / similarity() references can fail. pg_trgm is
-- relocatable — move it to public; no-op (caught) if it's already there.
do $$ begin
  execute 'alter extension pg_trgm set schema public';
exception when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emails text[] not null default '{}',
  phones text[] not null default '{}',
  company text,
  title text,
  location text,
  relationship_type text not null default 'personal'
    check (relationship_type in ('investor','lender','partner','vendor','personal','prospect')),
  source text,
  tags text[] not null default '{}',
  birthday date,
  important_dates jsonb not null default '[]', -- [{"label":"...","date":"YYYY-MM-DD"}]
  linkedin_url text,
  instagram_handle text,
  notes text,
  avatar_url text,
  keep_in_touch_days int, -- cadence lives on the contact; null = no cadence
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_name_trgm on public.contacts using gin (name gin_trgm_ops);
create index contacts_company_trgm on public.contacts using gin (coalesce(company,'') gin_trgm_ops);
create index contacts_emails on public.contacts using gin (emails);
create index contacts_tags on public.contacts using gin (tags);

create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- investor profiles (1:1 with contacts where relationship_type in investor/prospect)
-- ---------------------------------------------------------------------------

create table public.investor_profiles (
  contact_id uuid primary key references public.contacts(id) on delete cascade,
  accreditation_status text not null default 'unverified'
    check (accreditation_status in ('verified','claimed','unverified')),
  accreditation_verified_date date,
  nda_signed_date date,
  ppm_sent_date date,
  soft_commit_amount numeric,
  funded_amount numeric,
  preferred_structures text
    check (preferred_structures in ('note','equity','either')),
  sdira_or_tsp boolean not null default false,
  referral_source uuid references public.contacts(id) on delete set null,
  pipeline_stage text not null default 'lead'
    check (pipeline_stage in ('lead','contacted','nda','soft_commit','docs_sent','funded','passed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger investor_profiles_updated_at before update on public.investor_profiles
  for each row execute function public.set_updated_at();

create table public.pipeline_stage_history (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  stage text not null,
  changed_at timestamptz not null default now()
);

create index pipeline_stage_history_contact on public.pipeline_stage_history(contact_id, changed_at desc);

create or replace function public.record_stage_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.pipeline_stage is distinct from old.pipeline_stage then
    insert into public.pipeline_stage_history (contact_id, stage)
    values (new.contact_id, new.pipeline_stage);
  end if;
  return new;
end $$;

create trigger investor_profiles_stage_history
  after insert or update of pipeline_stage on public.investor_profiles
  for each row execute function public.record_stage_change();

-- ---------------------------------------------------------------------------
-- deals + participations
-- ---------------------------------------------------------------------------

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  entity text,
  status text not null default 'raising'
    check (status in ('raising','closed','in_development','exited')),
  target_raise numeric,
  raised_to_date numeric,
  structure_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger deals_updated_at before update on public.deals
  for each row execute function public.set_updated_at();

create table public.deal_participations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  role text not null default 'prospect'
    check (role in ('lender','lp','guarantor','co_developer','prospect')),
  amount numeric,
  rate numeric, -- annual %, for notes/loans
  key_dates jsonb not null default '[]', -- [{"label":"First interest installment","date":"YYYY-MM-DD"}]
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deal_participations_contact on public.deal_participations(contact_id);
create index deal_participations_deal on public.deal_participations(deal_id);

create trigger deal_participations_updated_at before update on public.deal_participations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- interactions
-- ---------------------------------------------------------------------------

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  channel text not null default 'other'
    check (channel in ('email','call','meeting','text','imessage','whatsapp','linkedin','instagram','in_person','other')),
  direction text not null default 'outbound' check (direction in ('inbound','outbound')),
  occurred_at timestamptz not null default now(),
  subject text,
  body text,
  external_id text, -- dedupe key for synced items (gmail message id, gcal event id, ...)
  source text not null default 'manual'
    check (source in ('manual','gmail','gcal','mcp_adapter','import')),
  created_at timestamptz not null default now()
);

create index interactions_contact on public.interactions(contact_id, occurred_at desc);
create unique index interactions_dedupe on public.interactions(source, external_id)
  where external_id is not null;

-- ---------------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------------

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  type text not null default 'follow_up'
    check (type in ('keep_in_touch','follow_up','date_based','deal_deadline')),
  title text not null,
  due_at timestamptz not null,
  cadence_days int, -- for keep_in_touch: regenerate this many days after last interaction
  status text not null default 'pending' check (status in ('pending','done','snoozed')),
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reminders_due on public.reminders(status, due_at);
create index reminders_contact on public.reminders(contact_id);
create unique index reminders_one_kit_per_contact on public.reminders(contact_id)
  where type = 'keep_in_touch';

create trigger reminders_updated_at before update on public.reminders
  for each row execute function public.set_updated_at();

-- Keep-in-touch auto-regeneration: any logged interaction (UI, MCP, ingest, Gmail
-- sync) pushes the contact's keep_in_touch reminder out by their cadence.
create or replace function public.regen_keep_in_touch()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  kit int;
begin
  select keep_in_touch_days into kit from public.contacts where id = new.contact_id;
  if kit is not null then
    insert into public.reminders (contact_id, type, title, due_at, cadence_days, status)
    values (new.contact_id, 'keep_in_touch', 'Keep in touch', new.occurred_at + make_interval(days => kit), kit, 'pending')
    on conflict (contact_id) where type = 'keep_in_touch'
    do update set
      due_at = greatest(excluded.due_at, reminders.due_at),
      cadence_days = kit,
      status = 'pending',
      snoozed_until = null,
      updated_at = now();
  end if;
  return new;
end $$;

create trigger interactions_regen_kit after insert on public.interactions
  for each row execute function public.regen_keep_in_touch();

-- Setting / changing the cadence on a contact creates or reschedules the reminder.
create or replace function public.sync_kit_reminder()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.keep_in_touch_days is null then
    delete from public.reminders where contact_id = new.id and type = 'keep_in_touch' and status <> 'done';
  else
    insert into public.reminders (contact_id, type, title, due_at, cadence_days, status)
    values (
      new.id, 'keep_in_touch', 'Keep in touch',
      coalesce(
        (select max(occurred_at) from public.interactions where contact_id = new.id),
        now()
      ) + make_interval(days => new.keep_in_touch_days),
      new.keep_in_touch_days, 'pending'
    )
    on conflict (contact_id) where type = 'keep_in_touch'
    do update set
      due_at = excluded.due_at,
      cadence_days = excluded.cadence_days,
      status = 'pending',
      snoozed_until = null,
      updated_at = now();
  end if;
  return new;
end $$;

create trigger contacts_sync_kit
  after insert or update of keep_in_touch_days on public.contacts
  for each row execute function public.sync_kit_reminder();

-- ---------------------------------------------------------------------------
-- MailerLite sync
-- ---------------------------------------------------------------------------

create table public.mailerlite_sync (
  contact_id uuid primary key references public.contacts(id) on delete cascade,
  mailerlite_subscriber_id text not null,
  subscription_status text,
  groups text[] not null default '{}',
  last_synced_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Google sync state (tokens + cursors) and cached upcoming meetings
-- ---------------------------------------------------------------------------

create table public.google_tokens (
  id int primary key default 1 check (id = 1), -- single row
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  google_email text,
  updated_at timestamptz not null default now()
);

create table public.sync_state (
  key text primary key, -- 'gmail' | 'gcal' | 'mailerlite'
  last_synced_at timestamptz,
  extra jsonb not null default '{}'
);

create table public.calendar_events (
  id text primary key, -- google event id
  summary text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  attendees jsonb not null default '[]',
  contact_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index calendar_events_starts on public.calendar_events(starts_at);

-- ---------------------------------------------------------------------------
-- fuzzy search (name / company / title / email / tag)
-- ---------------------------------------------------------------------------

create or replace function public.search_contacts(q text)
returns setof public.contacts
language sql stable as $$
  select c.* from public.contacts c
  where c.name ilike '%' || q || '%'
     or coalesce(c.company, '') ilike '%' || q || '%'
     or coalesce(c.title, '') ilike '%' || q || '%'
     or array_to_string(c.emails, ' ') ilike '%' || q || '%'
     or array_to_string(c.tags, ' ') ilike '%' || q || '%'
     or similarity(c.name, q) > 0.25
     or similarity(coalesce(c.company, ''), q) > 0.25
  order by greatest(similarity(c.name, q), similarity(coalesce(c.company,''), q)) desc, c.name
  limit 25;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: single user, so any authenticated session = Kevin.
-- Disable public signups in Supabase Auth settings (see README).
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'contacts','investor_profiles','pipeline_stage_history','deals',
    'deal_participations','interactions','reminders','mailerlite_sync',
    'google_tokens','sync_state','calendar_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all_%s" on public.%I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- google_tokens is only ever touched by server-side code with the service role;
-- keep it invisible to the browser session as defense in depth.
drop policy "owner_all_google_tokens" on public.google_tokens;

-- ---------------------------------------------------------------------------
-- seed: the three named deals (contacts stay empty; CSV import loads them)
-- ---------------------------------------------------------------------------

insert into public.deals (name, status) values
  ('The Avenue at Fountain Hills', 'raising'),
  ('4th Modern Detroit', 'in_development'),
  ('Wyndham Lakes', 'raising')
on conflict (name) do nothing;
