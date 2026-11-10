import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Plain text of every page, one line per visual line. PDF text items carry no
 * newline characters of their own; `hasEOL` is the only line-break signal.
 */
export async function extractPdfText(arrayBuffer) {
  const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  try {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const { items } = await page.getTextContent();
      pages.push(items.map((item) => (item.str ?? '') + (item.hasEOL ? '\n' : '')).join(''));
    }
    return pages.join('\n');
  } finally {
    await pdf.destroy();
  }
}
