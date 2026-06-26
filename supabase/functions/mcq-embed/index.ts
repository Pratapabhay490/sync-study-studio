// Embeds an uploaded document's text into pgvector chunks.
//
// POST body: { document_id: uuid, text: string }
// Requires Supabase user JWT. The caller must own document_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

const CHUNK_SIZE = 900;     // chars
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

async function embedBatch(inputs: string[]): Promise<(number[] | null)[]> {
  // Lovable AI Gateway is OpenAI-compatible; supports array input.
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Lovable-API-Key": LOVABLE_API_KEY ?? "",
      "X-Lovable-AIG-SDK": "supabase-edge-function",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: inputs,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`embeddings ${res.status}: ${detail}`);
  }
  const j = await res.json();
  const arr = Array.isArray(j?.data) ? j.data : [];
  // Ensure index ordering
  const out: (number[] | null)[] = new Array(inputs.length).fill(null);
  for (const item of arr) {
    if (typeof item?.index === "number" && Array.isArray(item?.embedding)) {
      out[item.index] = item.embedding;
    }
  }
  return out;
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

    // Verify ownership (RLS will also enforce)
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

    // Embed in batches of 16
    const BATCH = 16;
    let total = 0;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const embs = await embedBatch(slice);
      const rows = slice.map((content, j) => ({
        document_id: documentId,
        user_id: userId,
        chunk_index: i + j,
        content,
        embedding: embs[j] as unknown as string | null,
      })).filter((r) => r.embedding !== null);
      if (rows.length) {
        const { error: insErr } = await sb.from("quiz_chunks").insert(rows);
        if (insErr) throw insErr;
        total += rows.length;
      }
    }

    await sb.from("quiz_documents")
      .update({ status: "ready", chunk_count: total })
      .eq("id", documentId);

    return new Response(JSON.stringify({ ok: true, chunk_count: total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mcq-embed error:", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
