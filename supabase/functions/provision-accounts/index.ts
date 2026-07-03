// supabase/functions/provision-accounts/index.ts
//
// Mints auth logins for students, guardians, and staff and links each new
// user back to its record (students.user_id, etc.), then grants the right
// role. Requires the service-role key, so it runs only here — never in the
// browser. The caller must be an administrator of the target institution.
//
// Deploy: supabase functions deploy provision-accounts
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are injected.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ADMIN_ROLES = ['institution_admin', 'principal', 'vice_principal', 'registrar', 'proprietor', 'rector', 'provost'];
const TABLE: Record<string, string> = { student: 'students', guardian: 'guardians', staff: 'staff' };

interface Person { type: 'student' | 'guardian' | 'staff'; record_id: string; email: string; full_name?: string; role: string }
interface Body { institution_id: string; people: Person[] }

function tempPassword(): string {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(10); crypto.getRandomValues(arr);
  let s = ''; for (const nVal of arr) s += alpha[nVal % alpha.length];
  return `${s}#7`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  if (!body.institution_id || !Array.isArray(body.people) || body.people.length === 0) {
    return json({ error: 'Nothing to provision' }, 400);
  }

  // Identify caller and confirm they administer this institution.
  const asCaller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return json({ error: 'Not authenticated' }, 401);

  const admin = createClient(url, service);
  const { data: roles } = await admin.from('user_roles')
    .select('role').eq('user_id', user.id).eq('institution_id', body.institution_id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => ADMIN_ROLES.includes(r.role));
  if (!isAdmin) return json({ error: 'Not authorized for this institution' }, 403);

  const results: Array<Record<string, unknown>> = [];

  for (const p of body.people) {
    const table = TABLE[p.type];
    if (!table || !p.email?.trim() || !p.record_id) { results.push({ record_id: p.record_id, status: 'failed', error: 'Missing details' }); continue; }
    const password = tempPassword();
    try {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: p.email.trim(), password, email_confirm: true,
        user_metadata: { full_name: p.full_name ?? null, institution_id: body.institution_id },
      });
      if (cErr || !created.user) { results.push({ record_id: p.record_id, email: p.email, status: 'failed', error: cErr?.message ?? 'Could not create login' }); continue; }
      const uid = created.user.id;

      // Link the record and grant the role (service role bypasses RLS).
      await admin.from(table).update({ user_id: uid }).eq('id', p.record_id).eq('institution_id', body.institution_id);
      await admin.from('user_roles').insert({ user_id: uid, role: p.role, institution_id: body.institution_id });

      results.push({ record_id: p.record_id, email: p.email, status: 'created', password });
    } catch (e) {
      results.push({ record_id: p.record_id, email: p.email, status: 'failed', error: String((e as Error).message ?? e) });
    }
  }

  const created = results.filter((r) => r.status === 'created').length;
  return json({ created, failed: results.length - created, results });
});
