// Client-side extractors for PDF, DOCX, and plain text uploads.
// Runs entirely in the browser — no server cost, no Lovable AI usage.

const MAX_CHARS = 380_000;

function ensureLegacyBrowserPolyfills() {
  const trunc = Math.trunc ?? ((n: number) => (n < 0 ? Math.ceil(n) : Math.floor(n)));
  const ArrayProto = Array.prototype as Array<unknown> & {
    at?: (index: number) => unknown;
    flat?: (depth?: number) => unknown[];
    flatMap?: (callback: (value: unknown, index: number, array: unknown[]) => unknown) => unknown[];
  };
  if (typeof ArrayProto.at !== "function") {
    Object.defineProperty(Array.prototype, "at", {
      configurable: true,
      writable: true,
      value(index: number) {
        const length = this.length >>> 0;
        const relative = trunc(Number(index)) || 0;
        const k = relative >= 0 ? relative : length + relative;
        return k < 0 || k >= length ? undefined : this[k];
      },
    });
  }

  if (typeof ArrayProto.flat !== "function") {
    Object.defineProperty(Array.prototype, "flat", {
      configurable: true,
      writable: true,
      value(depth = 1) {
        const d = trunc(Number(depth)) || 0;
        const flatten = (arr: unknown[], level: number): unknown[] => arr.reduce<unknown[]>((acc, value) => {
          if (Array.isArray(value) && level > 0) acc.push(...flatten(value, level - 1));
          else acc.push(value);
          return acc;
        }, []);
        return flatten(Array.prototype.slice.call(this), d);
      },
    });
  }

  if (typeof ArrayProto.flatMap !== "function") {
    Object.defineProperty(Array.prototype, "flatMap", {
      configurable: true,
      writable: true,
      value(callback: (value: unknown, index: number, array: unknown[]) => unknown, thisArg?: unknown) {
        return Array.prototype.map.call(this, callback, thisArg).flat();
      },
    });
  }

  if (typeof Object.fromEntries !== "function") {
    Object.defineProperty(Object, "fromEntries", {
      configurable: true,
      writable: true,
      value(entries: Iterable<[PropertyKey, unknown]>) {
        const obj: Record<PropertyKey, unknown> = {};
        for (const [key, value] of entries) obj[key] = value;
        return obj;
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
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/legacy/build/pdf.worker.js?url")).default;

  try {
    const buf = await readAsArrayBuffer(file);
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buf),
      disableWorker: true,
      useWorkerFetch: false,
      isEvalSupported: false,
    }).promise;
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
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    throw new Error(message.includes("Invalid PDF")
      ? "This PDF could not be read. Please try another PDF or paste the text manually."
      : `Could not read this PDF: ${message}`);
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
