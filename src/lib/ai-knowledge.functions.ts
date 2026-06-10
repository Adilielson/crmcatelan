import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "ai-knowledge";

async function getTenantId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.tenant_id) throw new Error("Usuário sem tenant");
  return data.tenant_id as string;
}

export const listKnowledgeDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await getTenantId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("ai_knowledge_documents")
      .select("id, name, file_type, status, file_size_bytes, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

async function ensureBucket() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: false });
  }
}

export const uploadKnowledgeDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { name: string; file_type: string; content: string; file_base64?: string; file_size_bytes?: number };
    if (!i?.name || typeof i.content !== "string") throw new Error("Payload inválido");
    if (i.content.length > 200000) throw new Error("Texto extraído muito grande (>200k chars)");
    return i;
  })
  .handler(async ({ data, context }) => {
    const tenantId = await getTenantId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let fileUrl = "";
    if (data.file_base64) {
      await ensureBucket();
      const bytes = Uint8Array.from(atob(data.file_base64), (c) => c.charCodeAt(0));
      const path = `${tenantId}/${Date.now()}-${data.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from(BUCKET).upload(path, bytes, { contentType: data.file_type || "application/octet-stream", upsert: false });
      if (upErr) throw new Error(`Upload: ${upErr.message}`);
      fileUrl = path;
    }

    const { data: inserted, error } = await context.supabase
      .from("ai_knowledge_documents")
      .insert({
        tenant_id: tenantId,
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = input as { id: string };
    if (!i?.id) throw new Error("id obrigatório");
    return i;
  })
  .handler(async ({ data, context }) => {
    const tenantId = await getTenantId(context.supabase, context.userId);
    const { data: doc } = await context.supabase
      .from("ai_knowledge_documents").select("file_url").eq("id", data.id).eq("tenant_id", tenantId).maybeSingle();
    if (doc?.file_url) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from(BUCKET).remove([doc.file_url]).catch(() => {});
    }
    const { error } = await context.supabase
      .from("ai_knowledge_documents").delete().eq("id", data.id).eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
