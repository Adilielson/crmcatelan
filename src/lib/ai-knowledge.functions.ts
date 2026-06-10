import { createServerFn } from "@tanstack/react-start";
import { DEV_TENANT_ID, getDevSupabase } from "./dev-tenant.server";

// TODO(auth): trocar DEV_TENANT_ID/supabaseAdmin por requireSupabaseAuth
// + tenant_id real do profile quando Supabase Auth for implementado.

const BUCKET = "ai-knowledge";

export const listKnowledgeDocs = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = await getDevSupabase();
  const { data, error } = await supabase
    .from("ai_knowledge_documents")
    .select("id, name, file_type, status, file_size_bytes, created_at")
    .eq("tenant_id", DEV_TENANT_ID)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

async function ensureBucket() {
  const supabase = await getDevSupabase();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: false });
  }
}

export const uploadKnowledgeDoc = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const i = input as { name: string; file_type: string; content: string; file_base64?: string; file_size_bytes?: number };
    if (!i?.name || typeof i.content !== "string") throw new Error("Payload inválido");
    if (i.content.length > 200000) throw new Error("Texto extraído muito grande (>200k chars)");
    return i;
  })
  .handler(async ({ data }) => {
    const supabase = await getDevSupabase();

    let fileUrl = "";
    if (data.file_base64) {
      await ensureBucket();
      const bytes = Uint8Array.from(atob(data.file_base64), (c) => c.charCodeAt(0));
      const path = `${DEV_TENANT_ID}/${Date.now()}-${data.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET).upload(path, bytes, { contentType: data.file_type || "application/octet-stream", upsert: false });
      if (upErr) throw new Error(`Upload: ${upErr.message}`);
      fileUrl = path;
    }

    const { data: inserted, error } = await supabase
      .from("ai_knowledge_documents")
      .insert({
        tenant_id: DEV_TENANT_ID,
        name: data.name,
        file_url: fileUrl,
        file_type: data.file_type || "text/plain",
        status: "ready",
        content: data.content,
        file_size_bytes: data.file_size_bytes ?? null,
      } as any)
      .select("id, name, file_type, status, file_size_bytes, created_at")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const deleteKnowledgeDoc = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const i = input as { id: string };
    if (!i?.id) throw new Error("id obrigatório");
    return i;
  })
  .handler(async ({ data }) => {
    const supabase = await getDevSupabase();
    const { data: doc } = await supabase
      .from("ai_knowledge_documents").select("file_url").eq("id", data.id).eq("tenant_id", DEV_TENANT_ID).maybeSingle();
    if (doc?.file_url) {
      await supabase.storage.from(BUCKET).remove([doc.file_url]).catch(() => {});
    }
    const { error } = await supabase
      .from("ai_knowledge_documents").delete().eq("id", data.id).eq("tenant_id", DEV_TENANT_ID);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
