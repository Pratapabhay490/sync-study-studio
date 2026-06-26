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

export async function generateQuestions(opts: {
  subject?: string;
  topic?: string;
  difficulty: string;
  count: number;
  source: "ai" | "rag";
  document_ids?: string[];
  focus_text?: string;
}): Promise<{ questions: QuizQuestion[]; error?: string }> {
  const { data, error } = await sb.functions.invoke("mcq-generate", { body: opts });
  if (error) return { questions: [], error: String(error.message ?? error) };
  if (data?.error) return { questions: [], error: data.message ?? data.error };
  return { questions: (data?.questions ?? []) as QuizQuestion[] };
}

export async function embedDocument(documentId: string, text: string) {
  return sb.functions.invoke("mcq-embed", { body: { document_id: documentId, text } });
}
