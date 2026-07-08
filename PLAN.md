# IR CRM — Build Plan

Single-user, investor-relations-first personal CRM for Kevin Simpson (AK Capital
Investments). Dex replacement. Runs free forever on Vercel + Supabase free tiers.

**Location:** this repo (`kevinsimpson9/crm`) is the app root — import it into
Vercel as-is. The MCP server lives in `/mcp-server`.

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind — dark AK Capital theme (near-black,
  Inter, teal + gold accents)
- Supabase: Postgres + Auth (single email/password account), RLS on every table
- Vercel hosting + Vercel Cron
- MCP server: standalone Node/TS (`@modelcontextprotocol/sdk`), stdio for Claude
  Desktop + HTTP transport, service-role key to the same Supabase project
- No paid dependencies anywhere

## Phases (each independently shippable, committed in order)

| Phase | Scope |
|---|---|
| 0 | This plan + full schema migration SQL (`supabase/migrations/0001_init.sql`) |
| 1 | Core CRM: auth, contact CRUD, contact detail w/ timeline, global fuzzy search, 2-click quick-log, CSV import |
| 2 | IR layer: investor profiles, deals (seeded: The Avenue at Fountain Hills, 4th Modern Detroit, Wyndham Lakes), participations, drag-and-drop pipeline kanban, stage history, key-date reminders |
| 3 | Reminders + daily 6 AM PT digest email (Vercel Cron → Resend) |
| 4 | Google sync: Gmail (known-contact messages only, dedupe on message id), Calendar (past events → interactions, upcoming on dashboard), Contacts one-way import |
| 5 | MailerLite: subscriber/group pull + match by email, push contact segments to groups, status on contact pages |
| 6 | MCP server with all specified tools + Claude Desktop config in README |
| 7 | Channel adapters: authenticated `/api/ingest` + `ingest_interaction` MCP tool; README docs for iMessage/WhatsApp MCP bridges; quick-log bookmarklet for LinkedIn/Instagram (no scrapers) |

## Schema decisions made where the spec was silent

- `keep_in_touch_days` lives on `contacts` (per spec: cadence lives on the contact);
  a DB trigger regenerates the keep-in-touch reminder whenever an interaction is
  logged from ANY source (UI, MCP, ingest, Gmail sync).
- `pipeline_stage` lives on `investor_profiles`; `pipeline_stage_history` records
  every transition with a timestamp via trigger.
- Interaction dedupe: partial unique index on `(source, external_id)` where
  `external_id is not null`.
- `reminders.deal_id` (nullable) so deal-deadline reminders can point at a deal.
- Google OAuth tokens and sync cursors in `google_tokens` / `sync_state`
  (single-row, RLS-protected, service-role access from cron only).
- Free-tier notes (Supabase 500 MB, Vercel Hobby = 2 daily crons, MailerLite 1,000
  subs) are documented in the README, not engineered around.
