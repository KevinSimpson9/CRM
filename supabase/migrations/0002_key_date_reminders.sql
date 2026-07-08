-- Key dates on deal participations (e.g. "First interest installment") are
-- surfaced as deal_deadline reminders automatically, from any write path
-- (UI, MCP server, ingest).

create or replace function public.sync_deal_deadline_reminders()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.reminders
    where type = 'deal_deadline' and status = 'pending'
      and contact_id = old.contact_id and deal_id = old.deal_id;
    return old;
  end if;

  delete from public.reminders
  where type = 'deal_deadline' and status = 'pending'
    and contact_id = new.contact_id and deal_id = new.deal_id;

  insert into public.reminders (contact_id, deal_id, type, title, due_at)
  select
    new.contact_id,
    new.deal_id,
    'deal_deadline',
    (kd->>'label') || ' — '
      || (select name from public.contacts where id = new.contact_id) || ' · '
      || (select name from public.deals where id = new.deal_id),
    -- 16:00 UTC ≈ 9:00 AM PT on the key date
    ((kd->>'date')::date)::timestamptz + interval '16 hours'
  from jsonb_array_elements(new.key_dates) kd
  where (kd->>'date')::date >= current_date;

  return new;
end $$;

create trigger deal_participations_sync_reminders
  after insert or update of key_dates or delete on public.deal_participations
  for each row execute function public.sync_deal_deadline_reminders();
