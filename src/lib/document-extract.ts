// Client-side extractors for PDF, DOCX, and plain text uploads.
// Runs entirely in the browser — no server cost, no Lovable AI usage.

const MAX_CHARS = 380_000;

function ensureLegacyBrowserPolyfills() {
  const ArrayProto = Array.prototype as Array<unknown> & {
    at?: (index: number) => unknown;
  };
  if (typeof ArrayProto.at !== "function") {
    Object.defineProperty(Array.prototype, "at", {
      configurable: true,
      writable: true,
      value(index: number) {
        const length = this.length >>> 0;
        const relative = Math.trunc(index) || 0;
        const k = relative >= 0 ? relative : length + relative;
        return k < 0 || k >= length ? undefined : this[k];
      },
    });
  }

  const PromiseCtor = Promise as PromiseConstructor & {
    withResolvers?: <T>() => {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
    try?: <T>(fn: () => T | PromiseLike<T>) => Promise<T>;
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

  if (!PromiseCtor.try) {
    PromiseCtor.try = <T,>(fn: () => T | PromiseLike<T>) => new Promise<T>((resolve) => resolve(fn()));
  }
}

const PDF_WORKER_BOOTSTRAP = `
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    configurable: true,
    writable: true,
    value: function(index) {
      var length = this.length >>> 0;
      var relative = Math.trunc(index) || 0;
      var k = relative >= 0 ? relative : length + relative;
      return k < 0 || k >= length ? undefined : this[k];
    }
  });
}
if (!Promise.withResolvers) {
  Promise.withResolvers = function() {
    var resolve, reject;
    var promise = new Promise(function(res, rej) { resolve = res; reject = rej; });
    return { promise: promise, resolve: resolve, reject: reject };
  };
}
if (!Promise.try) {
  Promise.try = function(fn) { return new Promise(function(resolve) { resolve(fn()); }); };
}
`;

function clip(text: string): string {
  const clean = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
  return clean.length > MAX_CHARS ? clean.slice(0, MAX_CHARS) : clean;
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
  ensureLegacyBrowserPolyfills();

  // Use the older legacy pdf.js UMD build. It is much safer on iPad/Safari
  // than the current ESM build, which relies on newer browser APIs.
  const pdfModule: any = await import("pdfjs-dist/legacy/build/pdf.js");
  const pdfjs: any = pdfModule.getDocument ? pdfModule : (pdfModule.default ?? pdfModule);

  // The worker runs in a separate JavaScript context, so main-window polyfills
  // do not reach it. Wrap the worker with the same polyfills before pdf.js
  // starts parsing, fixing the Safari "undefined is not a function" crash.
  const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.js?url")).default;
  const absoluteWorkerUrl = new URL(workerUrl, window.location.href).href;
  const workerBlob = new Blob([
    PDF_WORKER_BOOTSTRAP,
    `\nimportScripts(${JSON.stringify(absoluteWorkerUrl)});`,
  ], { type: "text/javascript" });
  const workerSrc = URL.createObjectURL(workerBlob);
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  try {
    const buf = await readAsArrayBuffer(file);
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useWorkerFetch: false }).promise;
    const out: string[] = [];
    let chars = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items = content.items
        .map((it: any) => (it && "str" in it ? it.str : ""))
        .filter(Boolean);
      const pageText = items.join(" ");
      out.push(pageText);
      chars += pageText.length;
      if (chars > MAX_CHARS) break;
    }
    return out.join("\n\n");
  } finally {
    URL.revokeObjectURL(workerSrc);
  }
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
