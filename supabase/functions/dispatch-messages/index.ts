// supabase/functions/dispatch-messages/index.ts
//
// Drains queued rows from public.messages and sends them through a provider
// adapter chosen by channel. Runs with the service-role key, so it bypasses
// RLS to read/update the queue. Provider credentials come from Supabase
// secrets — they never live in the database or the browser.
//
// Set secrets before deploying:
//   supabase secrets set RESEND_API_KEY=...        EMAIL_FROM="School <noreply@yourschool.com>"
//   supabase secrets set TWILIO_ACCOUNT_SID=...     TWILIO_AUTH_TOKEN=...
//   supabase secrets set TWILIO_SMS_FROM=+1555...   TWILIO_WHATSAPP_FROM=+1555...
//
// Deploy:   supabase functions deploy dispatch-messages
// Schedule: invoke on a cron (e.g. every minute) or trigger after enqueue.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BATCH = 50;

interface QueuedMessage {
  id: string; channel: 'email' | 'sms' | 'whatsapp';
  recipient: string; subject: string | null; body: string;
}
interface SendResult { provider: string; id?: string }
interface Adapter { send(m: QueuedMessage): Promise<SendResult> }

const required = (k: string): string => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`${k} is not configured`);
  return v;
};

/* ------------------------------- email -------------------------------- */
const emailAdapter: Adapter = {
  async send(m) {
    const key = required('RESEND_API_KEY');
    const from = required('EMAIL_FROM');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: m.recipient, subject: m.subject ?? 'Notification', text: m.body }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { provider: 'resend', id: data?.id };
  },
};

/* ----------------------------- twilio core ---------------------------- */
async function twilioSend(to: string, body: string, from: string): Promise<SendResult> {
  const sid = required('TWILIO_ACCOUNT_SID');
  const token = required('TWILIO_AUTH_TOKEN');
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { provider: 'twilio', id: data?.sid };
}

const smsAdapter: Adapter = {
  send: (m) => twilioSend(m.recipient, m.body, required('TWILIO_SMS_FROM')),
};
const whatsappAdapter: Adapter = {
  send: (m) => twilioSend(`whatsapp:${m.recipient}`, m.body, `whatsapp:${required('TWILIO_WHATSAPP_FROM')}`),
};

const adapters: Record<QueuedMessage['channel'], Adapter> = {
  email: emailAdapter, sms: smsAdapter, whatsapp: whatsappAdapter,
};

/* ------------------------------- handler ------------------------------ */
Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: queued, error } = await supabase
    .from('messages').select('id, channel, recipient, subject, body')
    .eq('status', 'queued').order('created_at', { ascending: true }).limit(BATCH);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let sent = 0, failed = 0;
  for (const m of (queued ?? []) as QueuedMessage[]) {
    try {
      const result = await adapters[m.channel].send(m);
      await supabase.from('messages').update({
        status: 'sent', provider: result.provider, provider_message_id: result.id ?? null,
        sent_at: new Date().toISOString(), error: null,
      }).eq('id', m.id);
      sent++;
    } catch (e) {
      await supabase.from('messages').update({
        status: 'failed', error: String((e as Error).message ?? e),
      }).eq('id', m.id);
      failed++;
    }
  }

  return new Response(JSON.stringify({ processed: (queued ?? []).length, sent, failed }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
