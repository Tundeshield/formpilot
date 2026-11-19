/** Extract plain text from an uploaded document entirely in the browser. */
export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      pages.push(content.items.map((it: any) => (it.str || '') + (it.hasEOL ? '\n' : ' ')).join(''));
    }
    return pages.join('\n\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  if (name.endsWith('.docx')) {
    const mammoth: any = await import('mammoth/mammoth.browser.js');
    const { value } = await (mammoth.default || mammoth).extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return String(value).trim();
  }
  return (await file.text()).trim();
}
