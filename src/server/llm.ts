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
      console.error('LLM error', r.status, (await r.text()).slice(0, 500));
      throw new HttpError(502, r.status === 429 ? 'AI provider is rate-limiting requests. Try again shortly.' : 'AI provider error. Try again.');
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
  async completeJSON({ system, user, temperature = 0.3, maxTokens = 3000 }) {
    const data = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' }, {
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      temperature, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: user + '\n\nRespond with a single JSON object only.' }],
    });
    return parseJSON((data.content || []).map((c: any) => c.text || '').join(''));
  },
};

export function getLLM(): LLM {
  return (process.env.LLM_PROVIDER || 'openai').toLowerCase() === 'anthropic' ? anthropic : openai;
}
