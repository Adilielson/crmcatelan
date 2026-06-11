// Server functions para gerenciamento de equipe pelo Admin/Manager do tenant.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleEnum = z.enum(["admin", "manager", "seller"]);

const phoneRegex = /^\+?\d{10,15}$/;

const CreateSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().regex(phoneRegex, "Celular inválido (use só dígitos, com DDD)"),
  notification_phone: z.string().trim().regex(phoneRegex).optional().or(z.literal("")),
  role: RoleEnum,
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().regex(phoneRegex).optional(),
  notification_phone: z.string().trim().regex(phoneRegex).optional().or(z.literal("")),
  role: RoleEnum.optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

function generatePassword() {
  // 12 chars, letras + dígitos + símbolo simples (fácil de digitar uma vez)
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const sym = "!@#$%&*";
  const all = upper + lower + digits + sym;
  let out = "";
  out += upper[Math.floor(Math.random() * upper.length)];
  out += lower[Math.floor(Math.random() * lower.length)];
  out += digits[Math.floor(Math.random() * digits.length)];
  out += sym[Math.floor(Math.random() * sym.length)];
  for (let i = 0; i < 8; i++) out += all[Math.floor(Math.random() * all.length)];
  return out.split("").sort(() => Math.random() - 0.5).join("");
}

async function assertTenantAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", userId)
    .single();
  if (error || !data) throw new Error("Perfil não encontrado");
  if (!["admin", "manager", "super_admin"].includes(data.role)) {
    throw new Error("Apenas admin ou gerente do tenant pode gerenciar equipe");
  }
  return { tenantId: data.tenant_id as string, role: data.role as string };
}

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenantId } = await assertTenantAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, role, status, phone, notification_phone, avatar_url, last_login_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // pegar emails via auth.admin (em lote)
    const ids = (profiles ?? []).map((p: any) => p.id);
    const emails: Record<string, string> = {};
    for (const id of ids) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      if (u?.user?.email) emails[id] = u.user.email;
    }
    return (profiles ?? []).map((p: any) => ({ ...p, email: emails[p.id] ?? null }));
  });

export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { tenantId, role: callerRole } = await assertTenantAdmin(context.supabase, context.userId);
    if (data.role === "admin" && callerRole !== "admin" && callerRole !== "super_admin") {
      throw new Error("Apenas admin pode criar outro admin");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = generatePassword();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Falha ao criar usuário");

    // O trigger handle_new_user insere com tenant default. Atualizamos para o tenant correto.
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({
        tenant_id: tenantId,
        full_name: data.full_name,
        role: data.role,
        status: "active",
        phone: data.phone,
        notification_phone: data.notification_phone || data.phone,
      })
      .eq("id", created.user.id);
    if (upErr) throw new Error(upErr.message);

    return { id: created.user.id, email: data.email, password };
  });

export const regenerateTeamMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { tenantId } = await assertTenantAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // garantir que o alvo é do mesmo tenant
    const { data: target, error: tErr } = await supabaseAdmin
      .from("profiles").select("tenant_id").eq("id", data.id).single();
    if (tErr || !target) throw new Error("Membro não encontrado");
    if (target.tenant_id !== tenantId) throw new Error("Acesso negado");

    const password = generatePassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password });
    if (error) throw new Error(error.message);
    return { password };
  });

export const updateTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { tenantId } = await assertTenantAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target, error: tErr } = await supabaseAdmin
      .from("profiles").select("tenant_id").eq("id", data.id).single();
    if (tErr || !target) throw new Error("Membro não encontrado");
    if (target.tenant_id !== tenantId) throw new Error("Acesso negado");

    const patch: Record<string, unknown> = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.notification_phone !== undefined) patch.notification_phone = data.notification_phone || data.phone || null;
    if (data.role !== undefined) patch.role = data.role;
    if (data.status !== undefined) patch.status = data.status;

    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
