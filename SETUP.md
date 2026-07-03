# NegoLinks Education Management ERP — Setup Guide

This guide takes you from a fresh clone to a running system, two ways:

- **Part A — Offline / local**: everything on your machine, for development and trying it out.
- **Part B — Online / production**: a hosted Supabase backend plus the app served at
  your own domain, **school.negolinks.com**.

Both parts end with the same **one-time bootstrap** (Part C) that creates your
institution and your first administrator account.

---

## 0. Prerequisites

Install these once:

| Tool | Why | Check |
|------|-----|-------|
| **Node.js 20+** | builds and runs the web app | `node -v` |
| **npm** (ships with Node) | installs packages | `npm -v` |
| **Docker Desktop** | runs the local Supabase stack (Part A only) | `docker info` |
| **Supabase CLI** | applies migrations, deploys functions | `supabase -v` |

Install the Supabase CLI:

```bash
# macOS / Linux (Homebrew)
brew install supabase/tap/supabase

# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# or via npm (any OS)
npm install -g supabase
```

> The project is a small monorepo: the web app lives in `apps/web`, the backend
> in `supabase/`. Run Supabase commands from the **project root** (where
> `supabase/config.toml` lives) and npm commands from **`apps/web`**.

---

## Part A — Offline / local setup

### A1. Start the local backend

From the project root:

```bash
supabase start
```

The first run downloads Docker images (a few minutes). When it finishes it prints a
table of local URLs and keys — keep this handy. The important ones:

- **API URL** — `http://localhost:54321`
- **anon key** — a long JWT starting `eyJ…`
- **Studio** (database UI) — `http://localhost:54323`
- **Inbucket** (captured emails) — `http://localhost:54324`

You can reprint these any time with `supabase status`.

### A2. Apply the database schema

```bash
supabase db reset
```

This (re)creates the local database and runs all 25 migrations in
`supabase/migrations/` in order — every table, enum, function, trigger, RLS policy,
and the storage buckets. Re-run it whenever you want a clean slate.

> `enable_confirmations = false` is set in `config.toml`, so locally you can sign up
> and log in immediately without a confirmation email. (Inbucket still captures any
> emails the app sends, at `http://localhost:54324`.)

### A3. Point the web app at the local backend

```bash
cd apps/web
cp .env.example .env.local
```

Edit `.env.local` and paste the two values from step A1:

```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJ…the anon key…
```

### A4. Run the app

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. You'll see the sign-in screen.

### A5. (Optional) Run the Edge Functions locally

The core app runs without them. They power outbound messaging, the intelligence
engine, and bulk account provisioning. To run them:

```bash
# from the project root
supabase functions serve
```

If you want messaging/AI to actually send/call out, create
`supabase/functions/.env` with the relevant secrets (see Part B6 for the list) and
serve with `--env-file supabase/functions/.env`.

Now jump to **Part C** to create your institution and admin login.

---

## Part B — Online / production setup (school.negolinks.com)

You'll host the database on Supabase's cloud and the static web app on any static
host (Vercel, Netlify, Cloudflare Pages, etc.), then point your domain at it.

### B1. Create a Supabase project

1. Go to https://supabase.com → **New project**.
2. Choose a name, a strong **database password** (save it), and a region close to
   your users.
3. When it's ready, open **Project Settings → API** and note:
   - **Project URL** — `https://YOUR-REF.supabase.co`
   - **anon public key**
   - Your **project ref** (the `YOUR-REF` part).

### B2. Link the CLI to the project

From the project root:

```bash
supabase login                       # opens the browser to authorize
supabase link --project-ref YOUR-REF # paste the DB password when asked
```

### B3. Push the schema to the cloud

```bash
supabase db push
```

This applies the same 25 migrations to your hosted database. Confirm in the
dashboard's **Table Editor** that the tables exist and **Storage** shows the
`branding`, `documents`, and `submissions` buckets.

### B4. Deploy the Edge Functions

```bash
supabase functions deploy dispatch-messages
supabase functions deploy intelligence-engine
supabase functions deploy provision-accounts
```

### B5. Set the function secrets

Set only what you use. Messaging needs an email and/or SMS/WhatsApp provider; the
intelligence engine needs an OpenAI-compatible endpoint:

```bash
supabase secrets set \
  RESEND_API_KEY=...           EMAIL_FROM="NegoLinks <no-reply@negolinks.com>" \
  TWILIO_ACCOUNT_SID=...       TWILIO_AUTH_TOKEN=... \
  TWILIO_SMS_FROM=+1...        TWILIO_WHATSAPP_FROM=whatsapp:+1... \
  INTELLIGENCE_API_KEY=...     INTELLIGENCE_API_URL=https://api.openai.com/v1 \
  INTELLIGENCE_MODEL=gpt-4o-mini
```

`provision-accounts` needs no extra secrets — it uses the service role automatically.

### B6. Schedule the messaging dispatcher (optional)

`dispatch-messages` drains the outbound message queue. To run it on a schedule,
enable the `pg_cron` and `pg_net` extensions (Dashboard → **Database → Extensions**),
then in the **SQL Editor** schedule a call every five minutes:

```sql
select cron.schedule(
  'dispatch-messages-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR-REF.supabase.co/functions/v1/dispatch-messages',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer YOUR-SERVICE-ROLE-KEY'
    )
  );
  $$
);
```

(Keep the service-role key server-side only — never put it in the web app.)

### B7. Configure Auth for your domain

In the dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://school.negolinks.com`
- **Redirect URLs:** add `https://school.negolinks.com` (and
  `https://school.negolinks.com/**`).
- For production, **turn email confirmations ON** (Authentication → Providers →
  Email) and configure your SMTP/Resend sender so users receive real emails.

### B8. Build the web app for production

```bash
cd apps/web
cp .env.example .env.local
```

Set `.env.local` to your **cloud** values:

```
VITE_SUPABASE_URL=https://YOUR-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ…cloud anon key…
```

Then build:

```bash
npm install
npm run build      # outputs static files to apps/web/dist
```

### B9. Deploy the static site + SPA routing

The app is a **single-page app** with client-side routing, so the host must rewrite
all unknown paths to `index.html` (otherwise refreshing `/billing` 404s).

**Vercel** — set the project root to `apps/web`, build command `npm run build`,
output dir `dist`, add the two `VITE_…` env vars, and add a `vercel.json`:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

**Netlify** — base `apps/web`, build `npm run build`, publish `apps/web/dist`, add the
env vars, and create `apps/web/public/_redirects` containing:

```
/*  /index.html  200
```

**Cloudflare Pages / Nginx** — do the equivalent: serve `dist/` and fall back to
`index.html` for any route.

### B10. Point school.negolinks.com at the host

In your DNS provider, add the record your host gives you — usually a **CNAME** from
`school` → the host's target (e.g. `cname.vercel-dns.com` or
`your-site.netlify.app`). Add the custom domain in the host's dashboard so it
provisions an HTTPS certificate. Within a few minutes
**https://school.negolinks.com** serves the app.

> Public pages: `/apply` (admissions intake) and `/verify/:token` (document
> verification) work without login. For a single-school deployment, they operate
> against your one institution.

Now do **Part C** once, against your **cloud** database, to create the institution
and your admin account.

---

## Part C — One-time bootstrap (create your institution + first admin)

A brand-new database has no institutions and no users. Do this once.

### C1. Create your administrator login

Open the app (local `http://localhost:5173`, or `https://school.negolinks.com`),
click **"Need an account? Create one"**, and sign up with your email + a password.
This creates your auth user and a matching profile row.

> Locally this works instantly. In production with confirmations on, click the link
> in the email first.

### C2. Create the institution and link yourself as super admin

Open the **SQL Editor** (local: Studio at `http://localhost:54323`; cloud: the
dashboard) and run the following, editing the values. `slug` must be unique — use
your subdomain. `type` must be one of: `primary_school`, `secondary_school`,
`combined_school`, `college`, `polytechnic`, `university`, `professional_academy`,
`vocational_center`, `coaching_center`, `learning_institute`.

```sql
-- 1) Create your institution. Currency/timezone default to NGN / Africa/Lagos —
--    override them here if needed.
insert into public.institutions (slug, name, type, currency, timezone)
values ('negolinks', 'NegoLinks Academy', 'university', 'NGN', 'Africa/Lagos')
returning id;
--    ^ copy the id it returns into the statements below.

-- 2) Find the user id you just signed up with:
select id, email from auth.users order by created_at desc;

-- 3) Attach your profile to the institution and make you a super admin:
update public.profiles
set institution_id = 'PASTE-INSTITUTION-ID',
    is_super_admin = true
where id = 'PASTE-YOUR-USER-ID';

-- 4) Give yourself the top institutional role:
insert into public.user_roles (user_id, institution_id, role)
values ('PASTE-YOUR-USER-ID', 'PASTE-INSTITUTION-ID', 'institution_admin');
```

### C3. Reload the app

Refresh the browser. You're now signed in as an administrator of your institution,
with the full navigation available. From here, do it all in the UI:

1. **Settings** — add your logo, colours, and contact details (these brand the whole
   app, PDFs, and the public pages).
2. **Academics → Sessions & terms**, then **Structure** — set up the current session
   and your classes/arms or faculties/departments/programmes.
3. **People → Staff** and **Students** — add people (or use **Accounts** to bulk-
   provision logins, and **Admissions** to take applications at `/apply`).
4. **Teaching assignments** — assign teachers to subjects so the e-learning course
   pickers and score sheets scope correctly.
5. **Finance → Fee setup → Billing** — define fees and generate invoices; record
   payments; define **Scholarships** for concessions.

---

## Where students register (the public link)

Prospective students **do not need an account** — they apply from a public page:

```
https://school.negolinks.com/apply
```

The app figures out which institution the applicant is applying to in one of two ways:

1. **By subdomain** — the first label of the address (`school` in
   `school.negolinks.com`) is matched against your institution's **slug**. So if you
   created the institution with `slug = 'school'`, the clean link above just works.
2. **By `?school=` parameter** — `https://<any-domain>/apply?school=<your-slug>` works
   regardless of domain (handy while testing, on `localhost`, or on an apex domain).

You'll find both links, ready to copy, inside the app under **Settings → Public
links**, along with the document-verification URL pattern. The apply form and its
wording adapt to your institution type (a university sees "Programme applying for";
a primary/secondary school sees "Class applying for").

> Tip: pick your slug to match the subdomain you intend to publish. If you deploy at
> `school.negolinks.com`, set the institution slug to `school` in the bootstrap SQL.

## Troubleshooting

- **App shows "Missing Supabase env vars"** — `.env.local` is missing or unset.
  It must live in `apps/web/`, define both `VITE_…` variables, and you must restart
  `npm run dev` after editing it.
- **`supabase start` fails** — Docker isn't running, or ports 54321–54324 are in use.
  Start Docker Desktop; stop whatever holds those ports; try again.
- **Signed in but everything says "not authorized" / no data** — the bootstrap
  (Part C) hasn't been run for this account, or you ran it on a different database
  than the app points to. Re-check `institution_id`, `is_super_admin`, and the
  `user_roles` row, and confirm `VITE_SUPABASE_URL` matches that database.
- **Refreshing a deep link 404s in production** — SPA rewrites aren't configured
  (Part B9).
- **Sign-up does nothing in production** — email confirmations are on; check the
  inbox, or temporarily disable confirmations while testing.
- **A page is blank with a console import error** — see the note in
  `DEPLOYMENT.md`: with a codebase this size a first build can surface a stray
  import to fix; the error names the file and missing symbol.

---

## Day-to-day commands

```bash
# backend (project root)
supabase start            # bring the local stack up
supabase stop             # shut it down
supabase status           # print local URLs + keys
supabase db reset         # rebuild local DB from migrations
supabase db push          # apply migrations to the linked cloud project

# frontend (apps/web)
npm run dev               # dev server with hot reload
npm run build             # production build -> dist/
npm run preview           # preview the production build locally
```

For architecture, the security model, and the full route map, see **DEPLOYMENT.md**.

---

*NegoLinks Education Management ERP is a product of **Nego Links Systems Ltd**.*
