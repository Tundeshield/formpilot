import { HttpError, env } from './http';

export interface LLM {
  completeJSON(opts: { system: string; user: string; temperature?: number; maxTokens?: number }): Promise<unknown>;
}

function parseJSON(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new HttpError(502, 'The AI returned an unreadable response. Try again.');
  }
}

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!r.ok) {
      const body = await r.text();
      console.error('LLM error', r.status, body.slice(0, 500));
      let detail = '';
      try { const j = JSON.parse(body); detail = String(j?.error?.message || j?.message || '').slice(0, 200); } catch { /* not JSON */ }
      const hint = /credit balance|billing|quota/i.test(detail) ? 'The AI account has no API credits left. Top up billing for the API key.'
        : r.status === 401 || r.status === 403 ? 'The AI API key was rejected. Check the key in Netlify.'
        : r.status === 404 ? `AI model not found. ${detail}`
        : r.status === 429 ? 'AI provider is rate-limiting requests. Try again shortly.'
        : `AI provider error (${r.status})${detail ? `: ${detail}` : ''}`;
      throw new HttpError(502, hint);
    }
    return r.json() as Promise<any>;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(504, 'AI request timed out. Try again.');
  } finally { clearTimeout(timer); }
}

const openai: LLM = {
  async completeJSON({ system, user, temperature = 0.3, maxTokens = 3000 }) {
    const data = await post('https://api.openai.com/v1/chat/completions', { authorization: `Bearer ${env('OPENAI_API_KEY')}` }, {
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      temperature, max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    });
    return parseJSON(data.choices?.[0]?.message?.content || '');
  },
};

const anthropic: LLM = {
  // Current Claude models don't accept `temperature`; regenerate variety comes from the prompt instead.
  async completeJSON({ system, user, maxTokens = 3000 }) {
    const data = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' }, {
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: user + '\n\nRespond with a single JSON object only.' }],
    });
    return parseJSON((data.content || []).map((c: any) => c.text || '').join(''));
  },
};

export function getLLM(): LLM {
  return (process.env.LLM_PROVIDER || 'openai').toLowerCase() === 'anthropic' ? anthropic : openai;
}
