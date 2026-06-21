// Catálogo de módulos do sistema (compartilhado client+server).
export const MODULE_CATALOG = [
  { key: 'home', label: 'Início', path: '/' },
  { key: 'chat', label: 'Chat / Atendimento', path: '/chat' },
  { key: 'equipe', label: 'Equipe', path: '/equipe' },
  { key: 'kanban', label: 'Kanban', path: '/kanban' },
  { key: 'fila', label: 'Fila', path: '/fila' },
  { key: 'agenda', label: 'Agenda', path: '/agenda' },
  { key: 'clientes', label: 'Clientes', path: '/clientes' },
  { key: 'performance', label: 'Performance / Dashboard', path: '/performance' },
  { key: 'metas', label: 'Metas', path: '/metas' },
  { key: 'ranking', label: 'Ranking', path: '/ranking' },
  { key: 'no_show', label: 'Métricas No-Show', path: '/analytics/no-show' },
  { key: 'reports', label: 'Relatórios' },
  { key: 'marketing', label: 'Marketing', path: '/marketing' },
  { key: 'settings', label: 'Configurações', path: '/settings' },
  { key: 'ai_training', label: 'Treinamento IA', path: '/ai-training' },
  { key: 'ai_insights', label: 'Inteligência de Atendimento', path: '/ai-insights' },
  { key: 'users', label: 'Usuários', path: '/users' },
  { key: 'saas', label: 'Admin SaaS', path: '/saas' },
] as const;

export type ModuleKey = (typeof MODULE_CATALOG)[number]['key'];

export const ALL_MODULE_KEYS = MODULE_CATALOG.map((m) => m.key) as ModuleKey[];

// Defaults por papel — usados quando o tenant ainda não tem linhas em module_permissions.
// Evita que o menu apareça vazio enquanto o admin não configurou nada.
export const ROLE_DEFAULTS: Record<string, ModuleKey[]> = {
  admin: [...ALL_MODULE_KEYS],
  manager: ALL_MODULE_KEYS.filter((k) => k !== 'saas'),
  seller: ['home', 'chat', 'kanban', 'fila', 'agenda', 'clientes', 'metas', 'ranking'],
  marketing_partner: ['home', 'marketing', 'performance', 'no_show', 'reports', 'ai_insights'],
  super_admin: [...ALL_MODULE_KEYS],
};

export function defaultsForRole(role: string): Record<ModuleKey, boolean> {
  const allowed = new Set(ROLE_DEFAULTS[role] ?? ['home']);
  const out = {} as Record<ModuleKey, boolean>;
  for (const k of ALL_MODULE_KEYS) out[k] = allowed.has(k);
  return out;
}

// Mapa de path -> moduleKey, para guard de rotas.
export const PATH_TO_MODULE: Record<string, ModuleKey> = MODULE_CATALOG.reduce(
  (acc, m) => {
    if ('path' in m && m.path) acc[m.path] = m.key;
    return acc;
  },
  {} as Record<string, ModuleKey>,
);
