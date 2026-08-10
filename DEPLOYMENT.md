# NegoLinks Education Management ERP — Deployment & Operations Runbook

A multi-tenant education management platform. One shared database, tenant isolation by
`institution_id` + Postgres RLS, configured by institution type rather than code forks.

**Stack:** React 19 · TypeScript · Vite · Tailwind · shadcn/ui · React Query · React Hook Form · Zod ·
Supabase (Postgres, Auth, Storage, Edge Functions, RLS).

This document is the single source of truth for standing the system up. Work top to bottom.

---

## 1. Architecture at a glance

- **Tenancy:** every domain table carries `institution_id`; every table has RLS. A user's institution
  is derived from `user_roles`. The frontend resolves the tenant from the subdomain
  (`school.negolinks.com`) for both authenticated and public pages.
- **Authorization:** read access is governed by RLS policies; *privileged* actions (grading, issuing
  logins, admitting applicants, taking exams, sending announcements) run through `SECURITY DEFINER`
  functions that authorize themselves. Clients never get direct write access to sensitive tables.
- **Integrity:** stock/seat/copy counts are maintained by triggers, never trusted from the client.
- **Institution type:** `institutions.type` drives behaviour via the `isTertiary()` helper
  (university, polytechnic, college, professional_academy = tertiary; everything else = school-style).

---

## 2. Prerequisites

- A Supabase project (Postgres 15+, Auth, Storage, Edge Functions enabled).
- Supabase CLI authenticated and linked: `supabase link --project-ref <ref>`.
- Node 18+ and a package manager (npm/pnpm).
- (Optional, for delivery) a Resend account (email) and Twilio account (SMS/WhatsApp).
- (Optional, for the Intelligence Engine) any OpenAI-compatible Chat Completions endpoint + key.

---

## 3. Repository layout

```
supabase/
  migrations/        # 0001 … 0023 (apply in order)
  functions/
    dispatch-messages/index.ts
    intelligence-engine/index.ts
    provision-accounts/index.ts
apps/web/src/
  lib/               # supabase.ts, database.types.ts
  providers/         # app-providers.tsx (Auth/Tenant/Branding + AppProviders)
  features/
    settings/  people/  academics/  attendance/  results/  finance/
    cbt/  library/  admin/  comms/  intelligence/  provisioning/
    hostel/  transport/  inventory/  transcript/  admissions/  elearning/  portal/
```

---

## 4. Database — apply migrations in order

Run `supabase db push`, or apply each file in sequence. **Order matters** (later migrations depend
on helpers, enums, and tables from earlier ones).

| #    | File | What it adds |
|------|------|--------------|
| 0001 | foundation | extensions; core enums (`institution_type`, `app_role`, …); `institutions`, `campuses`, `profiles`, `user_roles`, `audit_logs`; RLS helpers; `handle_new_user` trigger |
| 0002 | branding_storage | storage buckets (`branding` public, `documents` private) + tenant-scoped policies; `document_verifications` + public `verify_document()` |
| 0003 | people | `students`, `staff`, `guardians`, `student_guardians`; `is_staff`, `is_my_ward`, `is_student_self` |
| 0004 | academic_structure | sessions, terms, classes, arms, faculties, departments, programmes, `subjects`, enrollments, teaching assignments |
| 0005 | attendance | `attendance_records`, `staff_attendance`; `save_attendance()` |
| 0006 | assessment | `assessment_components`, `student_scores` (staff-only initially) |
| 0007 | result_publishing | `result_publications` (draft→approved→published); `set_result_status()`; gated student score reads |
| 0008 | report_cards | `get_report_card_token()`, `student_position()` (leak-safe ranking) |
| 0009 | finance | `fee_structures`, `invoices` (generated balance), `invoice_items`, `payments`; `generate_invoices()`, `get_receipt_token()` |
| 0010 | cbt_authoring | question bank (categories, questions, options), `cbt_exams`, exam↔question links; `save_question()` |
| 0011 | cbt_taking | `cbt_attempts`, `cbt_answers`; `start_attempt`, `save_answer`, `bump_focus`, `submit_attempt`, `get_attempt_review` |
| 0012 | library | `library_settings`, `library_books`, `library_loans`; copy-count triggers; `is_library_staff` |
| 0013 | admin_dashboard | `admin_dashboard()` aggregate (leadership-gated) |
| 0014 | communications | `notifications`, `messages` queue, `message_templates`; `unread_count`, `mark_read`, `mark_all_read`, `send_announcement` |
| 0015 | documents | `documents` (Intelligence Engine output store) |
| 0016 | hostel | `hostels`, `hostel_rooms`, `hostel_allocations`; capacity trigger + one-bed-per-student index; `is_hostel_staff` |
| 0017 | transport | `vehicles`, `transport_routes`, `route_stops`, `transport_assignments`; capacity trigger; `is_transport_staff` |
| 0018 | inventory | `inventory_categories`, `inventory_items`, `stock_movements`; balance/oversell trigger; `is_inventory_staff` |
| 0019 | transcript | `subjects.credit_units`; `get_student_course_totals()` (SECURITY INVOKER) |
| 0020 | admissions | `admission_applications`; `submit_application()` (anon), `admit_application()`; `is_admissions_staff` |
| 0021 | finance_reports | `finance_report()` aggregate (finance-gated) |
| 0022 | elearning | `lesson_materials`, `assignments`, `assignment_submissions`; `submit_assignment`, `grade_submission` |
| 0023 | scholarships | `scholarships`, `student_scholarships`; `compute_student_discount`, `apply_scholarships_for_student`, `set_invoice_discount`; `generate_invoices` updated to apply discounts at billing |

> Keep `lib/database.types.ts` in sync — it is hand-maintained and already reflects every table,
> enum, and function above. If you add migrations, extend it the same way.

---

## 5. Storage buckets

Created in **0002**:

- **`branding`** — *public*. Logos and letterheads. Path: `{institution_id}/…`.
- **`documents`** — *private*. Stamps, signatures, generated report-card/receipt PDFs, and e-learning
  material uploads. Path: `{institution_id}/…`. Served to members via short-lived signed URLs.

> E-learning material uploads (0022) write to `documents` and are read via signed URLs. Confirm the
> 0002 policies allow institution members to read their own tenant's objects before relying on it.

---

## 6. Edge Functions

Three functions. Deploy each, then set its secrets. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the platform.

### 6.1 `dispatch-messages` — drains the outbound message queue
```bash
supabase functions deploy dispatch-messages
supabase secrets set RESEND_API_KEY=...  EMAIL_FROM="School <noreply@yourschool.com>"
supabase secrets set TWILIO_ACCOUNT_SID=...  TWILIO_AUTH_TOKEN=...
supabase secrets set TWILIO_SMS_FROM=+1555...  TWILIO_WHATSAPP_FROM=+1555...
```
Schedule it to run on a cron (e.g. every minute) to send queued `messages`. Until secrets exist,
in-app notifications work fully and external messages stay queued.

### 6.2 `intelligence-engine` — drafts institutional documents
```bash
supabase functions deploy intelligence-engine
supabase secrets set INTELLIGENCE_API_KEY=...
supabase secrets set INTELLIGENCE_API_URL=https://api.openai.com/v1/chat/completions
supabase secrets set INTELLIGENCE_MODEL=gpt-4o-mini
```
Provider-agnostic (OpenAI-compatible shape). The provider is never exposed to clients.

### 6.3 `provision-accounts` — mints student/guardian/staff logins
```bash
supabase functions deploy provision-accounts
```
No extra secrets (uses the injected service-role key). Requires the caller to be an institution admin.

---

## 7. Frontend configuration

`.env` (Vite):
```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Install dependencies:
```bash
npm i @supabase/supabase-js @tanstack/react-query react-hook-form @hookform/resolvers \
      zod sonner lucide-react @react-pdf/renderer qrcode
```

shadcn/ui components used (install via the shadcn CLI):
`button input textarea label switch separator card tabs dialog badge`.

Wrap the app in `<AppProviders>` (from `providers/app-providers.tsx`) and drop `<NotificationBell />`
in the header.

---

## 8. Route map

**Public (no auth — resolve tenant by subdomain):**

| Route | Page | Notes |
|-------|------|-------|
| `/apply` | ApplyPage | admission application intake |
| `/verify/:token` | VerifyPage | document authenticity check |

**Authenticated (role-gated):**

| Area | Routes |
|------|--------|
| Portal | `/dashboard` (student/parent) |
| People | `/students`, `/staff` |
| Academics | `/sessions`, `/structure`, `/teaching-assignments`, `/enrollment` |
| Attendance | `/attendance`, `/staff-attendance` |
| Results | `/assessment-setup`, `/score-sheet`, `/result-approval`, `/my-results` |
| Finance | `/fees-setup`, `/billing`, `/scholarships`, `/my-fees`, `/finance/reports` |
| CBT | `/question-bank`, `/exams`, `/take-exams`, `/exam-results` |
| Library | `/library`, `/library/loans`, `/my-library` |
| Hostel | `/hostels`, `/my-hostel` |
| Transport | `/vehicles`, `/routes`, `/my-transport` |
| Inventory | `/inventory` |
| Transcript | `/transcript` |
| Admissions | `/admissions` |
| E-learning | `/coursework` (teacher), `/learn` (student) |
| Comms | `/inbox`, `/announcements` |
| Tools | `/intelligence`, `/provisioning` |
| Settings | `/settings` |
| Admin | `/admin` (executive dashboard) |

Each page already enforces its own role guard via `useTenant().hasRole(...)`; wire your router's
guards to match (public routes must sit **outside** the auth guard).

---

## 9. Roles reference (`app_role`)

Gating groups used across the system:

- **Leadership / admin:** `institution_admin`, `principal`, `vice_principal`, `proprietor`, `rector`,
  `provost`, `registrar` — dashboards, settings, provisioning, admissions, announcements.
- **Finance:** `bursar`, `accountant` (+ leadership) — billing, finance reports.
- **Academic management:** `academic_officer`, `dean`, `head_of_department` (+ leadership) — result
  approval, structure.
- **Teaching:** `teacher`, `class_teacher`, `lecturer` — attendance, scores, CBT authoring, coursework.
- **Operations:** `librarian` (library), and hostel/transport/inventory managed by leadership roles.
- **Family/learner:** `student`, `parent`/`guardian` — read-own portals, exams, submissions.

---

## 10. First-run checklist

1. Apply migrations 0001–0027.
2. Create the first **institution** row (set `type`, name, currency, branding).
3. Create the first **super admin**: sign up a user, then set `profiles.is_super_admin = true`
   (super admins bypass tenant scoping).
4. Add an **institution admin**: insert a `user_roles` row (`role = 'institution_admin'`,
   `institution_id = <the institution>`).
5. Configure **grading scale** and **enabled modules** in `/settings`.
6. Create **sessions/terms** and **structure** (classes+arms or faculties+programmes+courses).
7. Load **people** (students/staff) — or take **admissions** in via `/apply` → `/admissions`.
8. **Provision logins** at `/provisioning` so students/guardians/staff can sign in (this is what
   activates the portals and notification delivery).
9. Deploy the **Edge Functions** and set secrets; schedule `dispatch-messages`.

---

## 11. Known gaps / polish (not blockers)

Resolved since the first cut: weighted-CGPA credit units are now editable on both the course and
subject forms; fee discounts/scholarships shipped in 0023 (define, award, auto-apply at billing, plus
a manual per-invoice discount); and the e-learning course pickers now scope to a user's taught/enrolled
courses (via `teaching_assignments`), with a teaching-assignments management screen to populate them.

Still open:

- **Assignment submissions** accept text + link, not file uploads (deliberate, to avoid per-student
  storage ACLs). Material uploads (teacher → `documents`) are supported. A file-upload path would need
  signed-upload tokens or a per-student storage policy.
- **Richer financial statements** (beyond the current finance report) are not yet built.
- On admission, only core identity is copied to the new student record; complete the profile in People,
  and seat the student via the existing Enrollment flow.

---

## 12. Security model recap

- **RLS everywhere.** No table is readable across tenants.
- **Definer functions for privileged writes:** taking/grading exams, submitting/grading coursework,
  issuing logins, admitting applicants, sending announcements, status transitions — each authorizes
  the caller itself; clients can't bypass by writing tables directly.
- **Leak-safe ranking & review:** positions and exam reviews return only what a user may see; answer
  keys never reach the browser.
- **Secrets stay server-side:** message providers and the Intelligence Engine provider live only in
  Edge Function secrets, never in the database or client.
- **Public surface is minimal:** only `/apply` (via an anon function) and `/verify/:token` (read-only,
  safe fields) are exposed without authentication.
```

---

*NegoLinks Education Management ERP is a product of **Nego Links Systems Ltd**.*
