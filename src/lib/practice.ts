import { supabase as supabaseTyped } from "@/integrations/supabase/client";

export const sb = supabaseTyped as unknown as {
  from: (t: string) => any;
  channel: (n: string) => any;
  removeChannel: (c: any) => any;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  functions: {
    invoke: (
      name: string,
      opts?: { body?: unknown },
    ) => Promise<{ data: any; error: any }>;
  };
};

export interface QuizQuestion {
  id: string;
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  pearls: string | null;
  difficulty: string;
  subject: string | null;
  topic: string | null;
  source: string;
}

export interface QuizSession {
  id: string;
  host_id: string;
  partner_id: string | null;
  mode: string;
  subject: string | null;
  topic: string | null;
  difficulty: string;
  source: string;
  document_ids: string[];
  question_count: number;
  seconds_per_question: number;
  status: "lobby" | "active" | "finished" | "cancelled";
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface QuizPlayer {
  id: string;
  session_id: string;
  user_id: string;
  status: string;
  current_index: number;
  score: number;
  correct_count: number;
  attempted_count: number;
  finished_at: string | null;
  joined_at: string;
}

export interface QuizDocument {
  id: string;
  title: string;
  source_type: string;
  subject: string | null;
  topic: string | null;
  char_count: number;
  chunk_count: number;
  status: string;
  created_at: string;
}

// In-flight dedupe: if the same request fires twice (Strict Mode double effect,
// rapid double click before React state flushes, etc.) reuse the pending promise.
const inflightGenerate = new Map<string, Promise<{ questions: QuizQuestion[]; error?: string }>>();

export async function generateQuestions(opts: {
  subject?: string;
  topic?: string;
  difficulty: string;
  count: number;
  source: "ai" | "rag";
  document_ids?: string[];
  focus_text?: string;
}): Promise<{ questions: QuizQuestion[]; error?: string }> {
  const key = JSON.stringify(opts);
  const existing = inflightGenerate.get(key);
  if (existing) {
    console.warn("[mcq-generate] duplicate call suppressed (in-flight dedupe)", { key });
    return existing;
  }

  const reqId = (globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const startedAt = new Date().toISOString();
  console.info("[mcq-generate] →", {
    request_id: reqId,
    timestamp: startedAt,
    endpoint: "edge:mcq-generate",
    opts: { ...opts, document_ids: opts.document_ids?.length ?? 0 },
  });

  const promise = (async () => {
    const t0 = performance.now();
    const { data, error } = await sb.functions.invoke("mcq-generate", {
      body: { ...opts, _client_request_id: reqId },
    });
    const ms = Math.round(performance.now() - t0);
    if (error) {
      console.error("[mcq-generate] ← transport error", { request_id: reqId, ms, error });
      return { questions: [], error: String(error.message ?? error) };
    }
    if (data?.error) {
      console.warn("[mcq-generate] ← handled error", { request_id: reqId, ms, server: data });
      return { questions: [], error: data.message ?? data.error };
    }
    console.info("[mcq-generate] ←", {
      request_id: reqId,
      server_request_id: data?._request_id,
      ms,
      questions: data?.questions?.length ?? 0,
      gemini_status: data?._gemini_status,
      prompt_chars: data?._prompt_chars,
      est_input_tokens: data?._est_input_tokens,
    });
    return { questions: (data?.questions ?? []) as QuizQuestion[] };
  })().finally(() => { inflightGenerate.delete(key); });

  inflightGenerate.set(key, promise);
  return promise;
}

export async function embedDocument(documentId: string, text: string) {
  return sb.functions.invoke("mcq-embed", { body: { document_id: documentId, text } });
}
