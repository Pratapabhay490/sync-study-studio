// Client-side extractors for PDF, DOCX, and plain text uploads.
// Runs entirely in the browser — no server cost, no Lovable AI usage.

const MAX_CHARS = 380_000;

function clip(text: string): string {
  const clean = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
  return clean.length > MAX_CHARS ? clean.slice(0, MAX_CHARS) : clean;
}

function ensurePromiseWithResolvers() {
  const PromiseCtor = Promise as PromiseConstructor & {
    withResolvers?: <T>() => {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  };

  if (!PromiseCtor.withResolvers) {
    PromiseCtor.withResolvers = <T,>() => {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }
}

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(file);
  });
}

function readAsText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}

async function extractPdf(file: File): Promise<string> {
  ensurePromiseWithResolvers();

  // Use the legacy ESM build: modern pdf.js workers call Promise.withResolvers,
  // which is missing in iPad/Safari versions still common in embedded previews.
  // @ts-expect-error - pdfjs-dist ESM build has no types for /legacy/build/pdf.mjs
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Keep the worker on the legacy build too; the modern worker can still crash
  // even when the main-thread module has been polyfilled.
  const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await readAsArrayBuffer(file);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
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
  const mammothModule = await import("mammoth");
  const mammoth = (mammothModule as any).default ?? mammothModule;
  const buf = await readAsArrayBuffer(file);
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return res.value ?? "";
}

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  let raw = "";
  if (/\.pdf$/.test(name)) raw = await extractPdf(file);
  else if (/\.docx$/.test(name)) raw = await extractDocx(file);
  else if (/\.(txt|md|markdown)$/.test(name)) raw = await readAsText(file);
  else throw new Error("Unsupported file type. Use .pdf, .docx, .txt, or .md");
  const clipped = clip(raw);
  if (!clipped) throw new Error("Could not extract any text from this file.");
  return clipped;
}
