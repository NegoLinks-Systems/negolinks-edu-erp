// supabase/functions/intelligence-engine/index.ts
//
// The NegoLinks Intelligence Engine. Drafts formal institutional documents
// (letters, memos, circulars, reports) from a brief. The language model
// runs entirely server-side; its identity and credentials never reach the
// client. Responses and errors are provider-neutral by design.
//
// Default provider: Groq Cloud (OpenAI-compatible). Any OpenAI-compatible
// endpoint works — switch provider by changing the three secrets below, no
// code change needed (OpenAI, xAI/Grok, DeepSeek, OpenRouter, Ollama, Azure…).
//
// Configure (Groq is the suite default):
//   supabase secrets set INTELLIGENCE_API_KEY=gsk_...                         # Groq key
//   supabase secrets set INTELLIGENCE_API_URL=https://api.groq.com/openai/v1/chat/completions
//   supabase secrets set INTELLIGENCE_MODEL=llama-3.3-70b-versatile
//
// Deploy:  supabase functions deploy intelligence-engine

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

interface Body {
  institutionName?: string; docType?: string; instructions?: string;
  fields?: { recipient?: string; subject?: string; sender?: string; date?: string };
}

function buildPrompt(b: Body): string {
  const f = b.fields ?? {};
  const lines = [
    `Institution: ${b.institutionName ?? 'the institution'}`,
    `Document type: ${b.docType ?? 'formal letter'}`,
    f.recipient ? `Addressed to: ${f.recipient}` : '',
    f.sender ? `From / signatory: ${f.sender}` : '',
    f.subject ? `Subject: ${f.subject}` : '',
    f.date ? `Date: ${f.date}` : '',
    '',
    'Brief / key points to convey:',
    b.instructions ?? '(none provided)',
  ].filter(Boolean);
  return lines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Require an authenticated caller.
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);
  } catch {
    return json({ error: 'Not authenticated' }, 401);
  }

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  if (!body.instructions || !body.instructions.trim()) return json({ error: 'Please describe what the document should say.' }, 400);

  const apiKey = Deno.env.get('INTELLIGENCE_API_KEY');
  const apiUrl = Deno.env.get('INTELLIGENCE_API_URL') ?? 'https://api.groq.com/openai/v1/chat/completions';
  const model = Deno.env.get('INTELLIGENCE_MODEL') ?? 'llama-3.3-70b-versatile';
  if (!apiKey) return json({ error: 'The Intelligence Engine is not configured yet.' }, 503);

  const system =
    'You are the NegoLinks Intelligence Engine, a professional writing assistant for educational institutions. ' +
    'Draft a complete, formal, ready-to-send document in the requested style. Use a courteous institutional tone. ' +
    'Do not invent specific facts (names, dates, amounts) that were not provided — leave a clear placeholder in square ' +
    'brackets instead. Respond with ONLY a JSON object of the form {"title": "...", "body": "..."} where "body" is ' +
    'plain text with paragraphs separated by a blank line. Do not use Markdown, headings, or code fences.';

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: buildPrompt(body) }],
      }),
    });
    if (!res.ok) {
      console.error('engine upstream error', res.status, await res.text());
      return json({ error: 'The Intelligence Engine could not complete this request. Please try again.' }, 502);
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    const cleaned = content.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

    let parsed: { title?: string; body?: string };
    try { parsed = JSON.parse(cleaned); }
    catch { parsed = { title: body.fields?.subject || (body.docType ?? 'Document'), body: cleaned }; }

    return json({
      title: (parsed.title || body.fields?.subject || 'Document').toString(),
      body: (parsed.body || '').toString(),
    });
  } catch (e) {
    console.error('engine error', e);
    return json({ error: 'The Intelligence Engine is temporarily unavailable.' }, 502);
  }
});
