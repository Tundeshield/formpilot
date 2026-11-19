import type { Config } from '@netlify/functions';
import { HttpError, authenticate, handler, json, monthKey, readJson } from '../../src/server/http';
import { extractProfile } from '../../src/server/extract';
import { getLLM } from '../../src/server/llm';

// The browser extracts text from the PDF/DOCX; this function structures that text.
export default handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const { uid, db } = await authenticate(req);
  const { documentId, text } = await readJson<{ documentId: string; text: string }>(req, 600_000);
  if (typeof text !== 'string' || text.trim().length < 40) throw new HttpError(422, 'Not enough readable text. Scanned/image-only PDFs are not supported yet.');
  if (!/^[\w-]{1,64}$/.test(String(documentId))) throw new HttpError(400, 'Invalid document');

  const path = `users/${uid}/documents/${documentId}`;
  if (!(await db.get(path))) throw new HttpError(404, 'Document not found');

  try {
    const extracted = await extractProfile(text, getLLM());
    await db.patch(path, { status: 'extracted', extracted, error: null });
    await db.increment(`users/${uid}/usage/${monthKey()}`, 'extracts', 1);
    return json({ extracted });
  } catch (e) {
    await db.patch(path, { status: 'failed', error: e instanceof Error ? e.message.slice(0, 300) : 'Extraction failed' }).catch(() => {});
    throw e;
  }
});

export const config: Config = { path: '/api/extract' };
