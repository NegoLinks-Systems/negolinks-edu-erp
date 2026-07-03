# NegoLinks Education Management ERP

A multi-tenant school/college/university management platform. One codebase serves
every institution type (primary, secondary, college, polytechnic, university,
academies and more) — behaviour is driven by configuration, not separate forks.
A single shared database isolates each institution with PostgreSQL Row-Level Security.

- **Frontend:** React 19 + TypeScript + Vite + Tailwind + shadcn/ui, React Query, React Hook Form + Zod.
- **Backend:** Supabase — PostgreSQL, Auth, Storage, Edge Functions, all guarded by RLS.

## What's in the box

```
negolinks/
├── apps/web/                 # the React application
│   ├── src/
│   │   ├── features/         # one folder per module (people, finance, results, cbt, …)
│   │   ├── components/ui/    # shadcn/ui primitives
│   │   ├── providers/        # auth + tenant + branding context
│   │   ├── lib/              # supabase client + generated DB types
│   │   ├── App.tsx           # router, auth gate, navigation shell
│   │   └── main.tsx          # entry point
│   ├── package.json
│   └── .env.example          # copy to .env.local
├── supabase/
│   ├── migrations/           # 24 ordered SQL migrations (the whole schema + RLS + RPCs)
│   ├── functions/            # 3 Edge Functions (messaging, intelligence, provisioning)
│   └── config.toml           # local-stack configuration
├── SETUP.md                  # ← START HERE: step-by-step offline + online setup
└── DEPLOYMENT.md             # deeper architecture, security model, route map
```

## Modules

People & admissions · academic structure · enrollment & attendance · assessment,
results & transcripts · finance (fees, invoices, payments, scholarships, reports) ·
computer-based testing · e-learning (materials, assignments, file submissions) ·
library · hostel · transport · inventory · communications · an analytics/intelligence
engine · account provisioning · and an executive admin dashboard.

## Getting started

See **[SETUP.md](./SETUP.md)** for the full walkthrough — both a local (offline)
install and a production (online) deployment to your own domain. For architecture
and the security model, see **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

The short version:

```bash
# 1. Backend (local) — needs Docker + the Supabase CLI
supabase start
supabase db reset          # applies all migrations

# 2. Frontend
cd apps/web
cp .env.example .env.local # then paste the URL + anon key from `supabase status`
npm install
npm run dev                # http://localhost:5173
```

Then create your institution and first admin user — the bootstrap SQL is in SETUP.md.

---

*NegoLinks Education Management ERP is a product of **Nego Links Systems Ltd**.*
