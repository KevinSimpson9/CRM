# AK Capital IR CRM

Single-user, investor-relations-first personal CRM for Kevin Simpson (AK Capital
Investments). Replaces Dex. Runs **free forever** on Vercel + Supabase free tiers.
Dark, dense, keyboard-first UI. Includes an MCP server so Claude can work the CRM
directly.

- Next.js 14 (App Router) · TypeScript · Tailwind
- Supabase (Postgres + Auth, RLS on every table)
- Vercel hosting + Vercel Cron
- Standalone MCP server in [`mcp-server/`](mcp-server/)
- **No paid dependencies anywhere.**

See [PLAN.md](PLAN.md) for the phase plan and schema decisions.

---

## Setup

### 1. Supabase (free tier)

1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → run `supabase/migrations/0001_init.sql`, then `0002_key_date_reminders.sql`.
3. **Auth → Providers → Email**: leave email/password on. **Auth → Settings: disable new user signups** after creating your account (single-user system; RLS grants any authenticated session full access).
4. Create your account: Auth → Users → Add user (email + password, auto-confirm).
5. Copy Project URL, anon key, and service_role key into env vars.

### 2. Vercel (free Hobby tier)

1. Import this repo into Vercel. If the app lives in a subdirectory, set **Root Directory** accordingly.
2. Add every variable from [`.env.example`](.env.example) in Project → Settings → Environment Variables.
3. Deploy. `vercel.json` registers two daily crons:
   - `/api/cron/digest` at 13:00 UTC (= 6 AM PT during daylight time; 5 AM PST in winter — Vercel cron is UTC-only, adjust the hour in `vercel.json` if the winter hour bothers you)
   - `/api/cron/google-sync` at 12:00 UTC

### 3. Resend (digest email, free tier)

1. Create an account at [resend.com](https://resend.com) (free: 100 emails/day).
2. Verify your sending domain (or use `onboarding@resend.dev` to start).
3. Set `RESEND_API_KEY`, `DIGEST_FROM`, `DIGEST_TO`.

### 4. Google (Gmail + Calendar + Contacts, your own free Cloud project)

1. [console.cloud.google.com](https://console.cloud.google.com) → new project → enable **Gmail API**, **Google Calendar API**, **People API**.
2. OAuth consent screen: External, Testing mode, add your own Gmail as a test user (Testing mode is fine forever for a single user; refresh tokens for test users expire after 7 days **only** if the app requests sensitive scopes and is unverified — gmail.readonly is sensitive, so either keep re-consenting weekly or push the consent screen to "In production" with the unverified-app warning, which is acceptable for a personal app).
3. Credentials → OAuth client ID → Web application → authorized redirect URI: `https://YOUR-APP.vercel.app/api/google/oauth/callback`.
4. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, then Settings → **Connect Google** in the app.

What syncs:
- **Gmail** — only messages to/from known contact emails; metadata + snippet only, never the full mailbox. Deduped per message id + contact.
- **Calendar** — past events with known contacts become `meeting` interactions; upcoming events (14 days) appear on the dashboard.
- **Contacts** — one-way import on demand from Settings. Never writes back to Google.

### 5. MailerLite (free tier)

Set `MAILERLITE_API_KEY` (MailerLite → Integrations → API). Settings page then offers:
- **Pull** subscribers + groups, matched to contacts by email (status/groups show on contact pages).
- **Push** a segment (deal NDA signers, deal participants, pipeline stage, tag, relationship type) into a group, created on demand.

### 6. Import your Rolodex

Contacts → **Import CSV** → drop your Dex/Rolodex export → confirm the auto-guessed column mapping → import.

---

## Free-tier limits (documented, not engineered around)

| Service | Limit that matters |
|---|---|
| Supabase free | 500 MB database, pauses after 1 week of zero activity (the daily cron hits keep it awake) |
| Vercel Hobby | **2 cron jobs, each once per day.** Gmail/Calendar auto-sync is therefore daily; use Settings → "Sync now" for on-demand. 10s default / 60s max function duration |
| Resend free | 100 emails/day, 3,000/month — the digest uses 1/day |
| MailerLite free | 1,000 subscribers, 12,000 emails/month |
| Gmail API | Generous free quota; the known-contacts-only query pattern stays far below it |

---

## MCP server (Claude Desktop / Claude Code)

The MCP server in [`mcp-server/`](mcp-server/) talks straight to Supabase with the
service-role key.

```bash
cd mcp-server
npm install
npm run build
```

### Claude Desktop config (local stdio)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "ir-crm": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/ir-crm/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://YOUR-PROJECT.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "eyJ...",
        "MAILERLITE_API_KEY": "eyJ... (optional, for push_segment_to_mailerlite)"
      }
    }
  }
}
```

Restart Claude Desktop, then ask things like:

> “Who's overdue for a follow-up in the Avenue pipeline?” → `list_due_followups` with `deal: "Avenue"`

### Tools

| Tool | What it does |
|---|---|
| `search_contacts` | Fuzzy search by name/company/email/tag |
| `get_contact` | Full record + investor profile + deals + timeline + reminders |
| `create_contact` | New contact |
| `log_interaction` | Log a touchpoint (resets keep-in-touch clock) |
| `create_reminder` | Follow-up / date-based reminder |
| `list_due_followups` | Due + overdue, optional per-deal filter |
| `update_pipeline_stage` | Move investor through lead → … → funded (history recorded) |
| `link_contact_to_deal` | Participation with role, amount, rate, key dates |
| `get_deal_summary` | Deal + all participants with terms and stages |
| `push_segment_to_mailerlite` | Push a segment into a MailerLite group |
| `draft_context` | Briefing pack for drafting outreach in Kevin's voice |
| `ingest_interaction` | Generic inbound message logging (see adapters) |

### Remote (HTTP) mode

```bash
MCP_HTTP_TOKEN=some-long-secret npm run start:http   # serves http://host:8808/mcp
```

Streamable-HTTP, stateless, bearer-token-guarded. Deploy anywhere free
(e.g. a Fly.io/Render free instance) if you want Claude to reach it away from your Mac.

---

## Channel adapters (iMessage, WhatsApp, anything)

Two equivalent inbound doors, both deduping on `external_id`:

1. **HTTP**: `POST {APP_URL}/api/ingest` with `Authorization: Bearer $INGEST_TOKEN`:

```bash
curl -X POST "$APP_URL/api/ingest" \
  -H "Authorization: Bearer $INGEST_TOKEN" -H "Content-Type: application/json" \
  -d '{"channel":"imessage","direction":"inbound","body":"Sounds good, send the PPM",
       "contact_phone":"+13135551234","external_id":"imsg-12345","occurred_at":"2026-07-08T14:30:00Z"}'
```

Contact matching: `contact_email` → `contact_phone` (last-10-digit match) → exact
`contact_name`; pass `create_if_missing: true` to auto-create.

2. **MCP**: the `ingest_interaction` tool — same fields, same matching.

### iMessage (Mac)

Use an open-source iMessage MCP server that reads `~/Library/Messages/chat.db`
(e.g. [`imessage-mcp`](https://github.com/search?q=imessage+mcp+chat.db) variants —
they need Full Disk Access for the host app). Wire it up by asking Claude Desktop,
with both servers connected: *"read yesterday's iMessages with ±phone/contact± and log
each to the CRM via ingest_interaction, using the iMessage GUID as external_id."*
Or run a small script against chat.db that POSTs to `/api/ingest`.

### WhatsApp

Open-source WhatsApp MCP bridges (e.g. projects built on `whatsmeow` that pair via
QR code as a linked device) expose message history as MCP tools. Same pattern:
Claude reads from the bridge, writes to `ingest_interaction` with the WhatsApp
message id as `external_id`.

### LinkedIn & Instagram — read this

There is **no legitimate free API for DM sync** on either platform, and scraping
violates their terms — so this CRM ships no scrapers. Instead:

- **Quick-log widget** on every contact page (2 clicks: channel, note).
- **Bookmarklet**: on any profile page, opens `/quicklog` pre-filled with the page's
  name/URL. Grab it from Settings → Channel adapters, or build it:

```
javascript:(()=>{const n=document.title.split('|')[0].split(/[-–(]/)[0].replace(/^\(\d+\)\s*/,'').trim();window.open('https://YOUR-APP.vercel.app/quicklog?name='+encodeURIComponent(n)+'&note='+encodeURIComponent('re: '+location.href),'_blank');})()
```

---

## Keyboard shortcuts

`/` search · `n` new contact · `g` then `h`/`c`/`p`/`d`/`r` → dashboard/contacts/pipeline/deals/reminders

## Security notes

- RLS is enabled on every table; the single authenticated user has full access.
  **Disable signups in Supabase** so no one else can create an account.
- `google_tokens` has **no** client-side RLS policy — only server code (service
  role) touches it.
- Cron routes require `Authorization: Bearer $CRON_SECRET`; ingest requires
  `$INGEST_TOKEN`; MCP HTTP mode requires `$MCP_HTTP_TOKEN`. All secrets live in
  env vars — `.env.example` is the complete list.
