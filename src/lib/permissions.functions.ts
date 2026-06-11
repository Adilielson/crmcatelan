import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { ALL_MODULE_KEYS, type ModuleKey } from './permissions';

const ModuleKeyEnum = z.enum(ALL_MODULE_KEYS as [ModuleKey, ...ModuleKey[]]);
const RoleEnum = z.enum(['admin', 'manager', 'seller', 'marketing_partner', 'super_admin']);

async function getCallerContext(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', userId)
    .single();
  if (error || !data) throw new Error('Perfil não encontrado');
  return { tenantId: data.tenant_id as string, role: data.role as string };
}

function assertAdmin(role: string) {
  if (!['admin', 'super_admin'].includes(role)) {
    throw new Error('Apenas administradores podem alterar permissões');
  }
}

// Retorna as permissões efetivas do USUÁRIO LOGADO (role default + overrides).
export const getMyPermissions = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenantId, role } = await getCallerContext(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    // super_admin tem acesso total
    if (role === 'super_admin') {
      return Object.fromEntries(ALL_MODULE_KEYS.map((k) => [k, true])) as Record<ModuleKey, boolean>;
    }

    const [{ data: roleRows }, { data: overrideRows }] = await Promise.all([
      supabaseAdmin
        .from('module_permissions')
        .select('module_key, allowed')
        .eq('tenant_id', tenantId)
        .eq('role', role),
      supabaseAdmin
        .from('user_module_overrides')
        .select('module_key, allowed')
        .eq('user_id', context.userId),
    ]);

    const result: Record<string, boolean> = {};
    for (const k of ALL_MODULE_KEYS) result[k] = false;
    for (const r of roleRows ?? []) result[r.module_key] = r.allowed;
    for (const o of overrideRows ?? []) result[o.module_key] = o.allowed;
    return result as Record<ModuleKey, boolean>;
  });

// Admin: lê permissões efetivas de UM usuário (role default + overrides).
export const getUserPermissions = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const caller = await getCallerContext(context.supabase, context.userId);
    assertAdmin(caller.role);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { data: target } = await supabaseAdmin
      .from('profiles').select('tenant_id, role').eq('id', data.userId).single();
    if (!target || target.tenant_id !== caller.tenantId) throw new Error('Acesso negado');

    const [{ data: roleRows }, { data: overrideRows }] = await Promise.all([
      supabaseAdmin
        .from('module_permissions')
        .select('module_key, allowed')
        .eq('tenant_id', caller.tenantId)
        .eq('role', target.role),
      supabaseAdmin
        .from('user_module_overrides')
        .select('module_key, allowed')
        .eq('user_id', data.userId),
    ]);

    const roleDefaults: Record<string, boolean> = {};
    for (const k of ALL_MODULE_KEYS) roleDefaults[k] = false;
    for (const r of roleRows ?? []) roleDefaults[r.module_key] = r.allowed;

    const overrides: Record<string, boolean | null> = {};
    for (const k of ALL_MODULE_KEYS) overrides[k] = null;
    for (const o of overrideRows ?? []) overrides[o.module_key] = o.allowed;

    return { role: target.role, roleDefaults, overrides };
  });

// Admin: salva overrides de um usuário (null = remove override, herda do papel).
export const updateUserPermissions = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      userId: z.string().uuid(),
      overrides: z.record(ModuleKeyEnum, z.union([z.boolean(), z.null()])),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const caller = await getCallerContext(context.supabase, context.userId);
    assertAdmin(caller.role);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { data: target } = await supabaseAdmin
      .from('profiles').select('tenant_id').eq('id', data.userId).single();
    if (!target || target.tenant_id !== caller.tenantId) throw new Error('Acesso negado');

    const toDelete: string[] = [];
    const toUpsert: { tenant_id: string; user_id: string; module_key: string; allowed: boolean }[] = [];
    for (const [k, v] of Object.entries(data.overrides)) {
      if (v === null) toDelete.push(k);
      else toUpsert.push({ tenant_id: caller.tenantId, user_id: data.userId, module_key: k, allowed: v });
    }

    if (toDelete.length) {
      await supabaseAdmin
        .from('user_module_overrides')
        .delete()
        .eq('user_id', data.userId)
        .in('module_key', toDelete);
    }
    if (toUpsert.length) {
      const { error } = await supabaseAdmin
        .from('user_module_overrides')
        .upsert(toUpsert as never, { onConflict: 'user_id,module_key' });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// Admin: lê defaults por papel do tenant.
export const getRoleDefaults = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ role: RoleEnum }).parse(d))
  .handler(async ({ data, context }) => {
    const caller = await getCallerContext(context.supabase, context.userId);
    assertAdmin(caller.role);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: rows } = await supabaseAdmin
      .from('module_permissions')
      .select('module_key, allowed')
      .eq('tenant_id', caller.tenantId)
      .eq('role', data.role);
    const out: Record<string, boolean> = {};
    for (const k of ALL_MODULE_KEYS) out[k] = false;
    for (const r of rows ?? []) out[r.module_key] = r.allowed;
    return out;
  });

export const updateRoleDefaults = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      role: RoleEnum,
      perms: z.record(ModuleKeyEnum, z.boolean()),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const caller = await getCallerContext(context.supabase, context.userId);
    assertAdmin(caller.role);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const rows = Object.entries(data.perms).map(([k, v]) => ({
      tenant_id: caller.tenantId, role: data.role, module_key: k, allowed: v,
    }));
    const { error } = await supabaseAdmin
      .from('module_permissions')
      .upsert(rows as never, { onConflict: 'tenant_id,role,module_key' });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
