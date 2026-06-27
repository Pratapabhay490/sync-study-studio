// Indexes uploaded document text into searchable chunks.
// IMPORTANT: this function does not call Gemini. Uploading notes must not
// consume AI quota or create hidden duplicate model requests before Start Quiz.
//
// POST body: { document_id: uuid, text: string }
// Requires Supabase user JWT. The caller must own document_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 120;

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + CHUNK_SIZE, clean.length);
    chunks.push(clean.slice(i, end));
    if (end === clean.length) break;
    i = end - CHUNK_OVERLAP;
  }
  return chunks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  try {
    const body = await req.json().catch(() => ({}));
    const documentId = String(body?.document_id ?? "");
    const text = String(body?.text ?? "");
    if (!documentId || !text.trim()) {
      return new Response(JSON.stringify({ error: "missing_input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > 400_000) {
      return new Response(JSON.stringify({ error: "too_large", message: "Document too large (>400k chars). Split it." }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: doc, error: docErr } = await sb
      .from("quiz_documents")
      .select("id, user_id")
      .eq("id", documentId)
      .maybeSingle();
    if (docErr || !doc || doc.user_id !== userId) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sb.from("quiz_documents").update({ status: "embedding", char_count: text.length }).eq("id", documentId);
    await sb.from("quiz_chunks").delete().eq("document_id", documentId);

    const chunks = chunkText(text);
    if (!chunks.length) {
      await sb.from("quiz_documents").update({ status: "ready", chunk_count: 0 }).eq("id", documentId);
      return new Response(JSON.stringify({ ok: true, chunk_count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = chunks.map((content, i) => ({
      document_id: documentId,
      user_id: userId,
      chunk_index: i,
      content,
      embedding: null,
    }));
    const { error: insErr } = await sb.from("quiz_chunks").insert(rows);
    if (insErr) throw insErr;

    await sb.from("quiz_documents")
      .update({ status: "ready", chunk_count: rows.length })
      .eq("id", documentId);

    return new Response(JSON.stringify({ ok: true, chunk_count: rows.length, ai_requests: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mcq-embed error:", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
