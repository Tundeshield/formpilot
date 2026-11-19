import type { Config } from '@netlify/functions';
import { HttpError, authenticate, handler, json, readJson } from '../../src/server/http';
import { extractProfile } from '../../src/server/extract';
import { getLLM } from '../../src/server/llm';

// The browser extracts text from the PDF/DOCX (no file bytes leave Supabase Storage
// except to the user's own browser); this function structures that text.
export default handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const { user, db } = await authenticate(req);
  const { documentId, text } = await readJson<{ documentId: string; text: string }>(req, 600_000);
  if (typeof text !== 'string' || text.trim().length < 40) throw new HttpError(422, 'Not enough readable text. Scanned/image-only PDFs are not supported yet.');

  const { data: doc } = await db.from('documents').select('id').eq('id', documentId).maybeSingle();
  if (!doc) throw new HttpError(404, 'Document not found');

  try {
    const extracted = await extractProfile(text, getLLM());
    await db.from('documents').update({ status: 'extracted', extracted, error: null }).eq('id', documentId);
    await db.from('usage_events').insert({ user_id: user.id, kind: 'extract', units: 1 });
    return json({ extracted });
  } catch (e) {
    await db.from('documents').update({ status: 'failed', error: e instanceof Error ? e.message.slice(0, 300) : 'Extraction failed' }).eq('id', documentId);
    throw e;
  }
});

export const config: Config = { path: '/api/extract' };
