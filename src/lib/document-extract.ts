// Client-side extractors for PDF, DOCX, and plain text uploads.
// Runs entirely in the browser — no server cost, no Lovable AI usage.

import mammoth from "mammoth";

const MAX_CHARS = 380_000;

function clip(text: string): string {
  const clean = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
  return clean.length > MAX_CHARS ? clean.slice(0, MAX_CHARS) : clean;
}

async function extractPdf(file: File): Promise<string> {
  // pdfjs ships an ESM build that works in the browser.
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  // Use the bundled worker via Vite ?url.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .map((it: any) => ("str" in it ? it.str : ""))
      .filter(Boolean);
    out.push(items.join(" "));
    if (out.join(" ").length > MAX_CHARS) break;
  }
  return out.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return res.value ?? "";
}

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  let raw = "";
  if (/\.pdf$/.test(name)) raw = await extractPdf(file);
  else if (/\.docx$/.test(name)) raw = await extractDocx(file);
  else if (/\.(txt|md|markdown)$/.test(name)) raw = await file.text();
  else throw new Error("Unsupported file type. Use .pdf, .docx, .txt, or .md");
  const clipped = clip(raw);
  if (!clipped) throw new Error("Could not extract any text from this file.");
  return clipped;
}
