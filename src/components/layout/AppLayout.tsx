import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore, buildFallbackUser } from '@/hooks/use-auth';
import { readLocalSession } from '@/lib/local-session';
import {
  Home,
  Users,
  MessageSquare,
  Calendar,
  Settings,
  LogOut,
  Columns,
  ShieldCheck,
  Brain,
  TrendingDown,
  Inbox,
  Contact,
  Menu,
  ChevronDown,
  BarChart3,
  FileBarChart,
  Megaphone,
  UserCog,
  Bell,
  Target,
  Trophy,
  Award,
  KeyRound,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getAiConfig, updateAiConfig } from '@/lib/ai-training.functions';
import { toast } from 'sonner';
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog';


/* ============ MOBILE BOTTOM NAV ============ */
const MobileBottomNav = ({ pathname }: { pathname: string }) => {
  const items = [
    { label: 'Início', icon: Home, href: '/' },
    { label: 'Atendimento', icon: MessageSquare, href: '/chat' },
    { label: 'Exames', icon: Calendar, href: '/agenda' },
    { label: 'Clientes', icon: Contact, href: '/clientes' },
  ];
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0f172a] border-t border-[#1e293b]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-stretch justify-around h-[60px]">
        {items.map((it) => {
          const Icon = it.icon;
          const active = pathname === it.href;
          return (
            <li key={it.href} className="flex-1 flex items-center justify-center">
              <Link
                to={it.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 min-w-[64px] transition-colors duration-150',
                  active ? 'text-white' : 'text-[#64748b]',
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center transition-all duration-150',
                    active
                      ? 'bg-[#1e293b] rounded-2xl px-3 py-1'
                      : 'px-3 py-1',
                  )}
                >
                  <Icon className={cn('w-5 h-5', active ? 'text-white' : 'text-[#64748b]')} />
                </span>
                <span
                  className={cn(
                    'text-[11px] leading-none truncate max-w-[80px]',
                    active ? 'text-white font-semibold' : 'text-[#64748b]',
                  )}
                >
                  {it.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
import { cn } from '@/lib/utils';
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { NotificationCenter } from './NotificationCenter';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { usePermissions } from '@/hooks/use-permissions';
import type { ModuleKey } from '@/lib/permissions';

type NavLeaf = { label: string; icon: any; href: string; module?: ModuleKey };
type NavGroup = { label: string; icon?: any; children: NavLeaf[] };
type NavItem = NavLeaf | NavGroup;

const isGroup = (i: NavItem): i is NavGroup => 'children' in i;

const Logo = () => (
  <div className="flex items-center gap-2.5 shrink-0">
    <div className="p-1.5 bg-[#f5c518]/10 rounded-lg">
      <svg className="w-7 h-3.5 text-[#f5c518]" viewBox="0 0 60 28">
        <path
          d="M3 8 Q3 4 8 4 L24 4 Q28 4 28 9 L28 16 Q28 23 19 23 L11 23 Q3 23 3 14 Z M32 8 Q32 4 37 4 L53 4 Q57 4 57 9 L57 14 Q57 23 49 23 L41 23 Q32 23 32 16 Z M28 9 L32 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
    <span className="text-white font-bold text-sm tracking-wider hidden sm:inline">
      ÓTICA CATELAN
    </span>
  </div>
);

const useNavItems = (isSuperAdmin: boolean): NavItem[] => {
  const items: NavItem[] = [
    { label: 'Início', icon: Home, href: '/', module: 'home' },
    {
      label: 'Atendimento',
      icon: MessageSquare,
      children: [
        { label: 'Chat', icon: MessageSquare, href: '/chat', module: 'chat' },
        { label: 'Equipe', icon: Users, href: '/equipe', module: 'equipe' },
      ],
    },
    { label: 'Kanban', icon: Columns, href: '/kanban', module: 'kanban' },
    { label: 'Fila', icon: Inbox, href: '/fila', module: 'fila' },
    { label: 'Agenda', icon: Calendar, href: '/agenda', module: 'agenda' },
    { label: 'Clientes', icon: Contact, href: '/clientes', module: 'clientes' },
    { label: 'Resultados', icon: Award, href: '/resultados', module: 'resultados' },
    {
      label: 'Performance',
      icon: BarChart3,
      children: [
        { label: 'BI Executivo', icon: BarChart3, href: '/bi', module: 'bi' },
        { label: 'Dashboard', icon: BarChart3, href: '/performance', module: 'performance' },
        { label: 'Metas', icon: Target, href: '/metas', module: 'metas' },
        { label: 'Ranking', icon: Trophy, href: '/ranking', module: 'ranking' },
        { label: 'Métricas No-Show', icon: TrendingDown, href: '/analytics/no-show', module: 'no_show' },
        { label: 'Inteligência IA', icon: Brain, href: '/ai-insights', module: 'ai_insights' },
        { label: 'Relatórios', icon: FileBarChart, href: '/relatorios', module: 'reports' },
      ],
    },
    { label: 'Marketing', icon: Megaphone, href: '/marketing', module: 'marketing' },
    {
      label: 'Ajustes',
      icon: Settings,
      children: [
        { label: 'Configurações', icon: Settings, href: '/settings', module: 'settings' },
        { label: 'Treinamento IA', icon: Brain, href: '/ai-training', module: 'ai_training' },
        { label: 'Usuários', icon: UserCog, href: '/users', module: 'users' },
        ...(isSuperAdmin
          ? [{ label: 'Admin SaaS', icon: ShieldCheck, href: '/saas', module: 'saas' as ModuleKey }]
          : []),
      ],
    },
  ];
  return items;
};

function filterItems(items: NavItem[], can: (k: ModuleKey) => boolean): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    if (isGroup(item)) {
      const kids = item.children.filter((c) => !c.module || can(c.module));
      if (kids.length) out.push({ ...item, children: kids });
    } else {
      if (!item.module || can(item.module)) out.push(item);
    }
  }
  return out;
}

const isItemActive = (item: NavItem, pathname: string): boolean => {
  if (isGroup(item)) return item.children.some((c) => c.href === pathname);
  return item.href === pathname;
};

/* ============ DROPDOWN (desktop) ============ */
const NavDropdown = ({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = isItemActive(group, pathname);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-all duration-150 ease-in-out',
          active
            ? 'bg-[#1e293b] text-[#f5c518]'
            : 'text-slate-400 hover:text-white',
        )}
      >
        {group.label}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 min-w-[220px] bg-[#1e293b] rounded-xl shadow-xl ring-1 ring-black/5 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {group.children.map((c) => {
            const Icon = c.icon;
            const isActive = pathname === c.href;
            return (
              <Link
                key={c.label + c.href}
                to={c.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150',
                  isActive
                    ? 'bg-[#334155] text-white'
                    : 'text-slate-300 hover:bg-[#334155] hover:text-white',
                )}
              >
                <Icon className="w-4 h-4 text-[#f5c518]" />
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ============ USER MENU ============ */
const UserMenu = ({ user, onLogout }: { user: any; onLogout: () => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-white/5 transition-colors duration-150"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-[#f5c518]/40"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f5c518] to-[#d4a900] flex items-center justify-center text-[#0f172a] font-bold text-xs">
            {user.name?.charAt(0)?.toUpperCase()}
          </div>
        )}
        <div className="hidden md:flex flex-col items-start leading-tight">
          <span className="text-xs font-semibold text-white truncate max-w-[120px]">{user.name}</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">{user.role}</span>
        </div>
        <ChevronDown className={cn('hidden md:block w-3.5 h-3.5 text-slate-400 transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 min-w-[200px] bg-[#1e293b] rounded-xl shadow-xl ring-1 ring-black/5 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-3 px-3 py-2 border-b border-white/5 mb-1">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-[#f5c518]/40"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f5c518] to-[#d4a900] flex items-center justify-center text-[#0f172a] font-bold text-xs">
                {user.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">{user.role}</p>
            </div>
          </div>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-[#334155] hover:text-white transition-colors duration-150"
          >
            <Settings className="w-4 h-4 text-[#f5c518]" />
            Configurações
          </Link>
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors duration-150"
          >
            <LogOut className="w-4 h-4" />
            Encerrar sessão
          </button>
        </div>
      )}
    </div>
  );
};

/* ============ IA SDR Kill Switch (emergência) ============ */
const AiToggle = () => {
  const qc = useQueryClient();
  const getCfg = useServerFn(getAiConfig);
  const saveCfg = useServerFn(updateAiConfig);

  const cfgQuery = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => getCfg(),
    staleTime: 30_000,
  });

  const on = (cfgQuery.data as any)?.autopilot_enabled !== false;

  const mut = useMutation({
    mutationFn: (next: boolean) => saveCfg({ data: { autopilot_enabled: next } as any }),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ['ai-config'] });
      const prev = qc.getQueryData(['ai-config']);
      qc.setQueryData(['ai-config'], (old: any) => ({ ...(old ?? {}), autopilot_enabled: next }));
      return { prev };
    },
    onError: (err: any, _next, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['ai-config'], ctx.prev);
      toast.error(err?.message ?? 'Falha ao alterar IA');
    },
    onSuccess: (_r, next) => {
      toast[next ? 'success' : 'warning'](
        next ? 'IA SDR reativada — respondendo automaticamente' : 'IA SDR PAUSADA — nenhum cliente será respondido pela IA',
      );
      qc.invalidateQueries({ queryKey: ['ai-config'] });
    },
  });

  const handleClick = () => {
    if (cfgQuery.isLoading || mut.isPending) return;
    if (on) {
      const ok = window.confirm(
        'PAUSAR a IA SDR?\n\nEnquanto estiver pausada, nenhuma mensagem do WhatsApp será respondida automaticamente. Use em caso de alucinação ou emergência.',
      );
      if (!ok) return;
    }
    mut.mutate(!on);
  };

  const disabled = cfgQuery.isLoading || mut.isPending;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={on ? 'IA ATIVA — clique para pausar (emergência)' : 'IA PAUSADA — clique para reativar'}
      className={cn(
        'hidden xl:flex items-center gap-3 rounded-full pl-3 pr-1.5 py-1 border transition-all',
        on
          ? 'bg-white/5 border-white/10 hover:bg-white/10'
          : 'bg-red-500/15 border-red-500/40 hover:bg-red-500/25 animate-pulse',
        disabled && 'opacity-60 cursor-wait',
      )}
    >
      <div className="flex flex-col leading-tight items-start">
        <span className="text-[10px] font-semibold text-white">
          {on ? 'Monitoramento' : 'EMERGÊNCIA'}
        </span>
        <span
          className={cn(
            'text-[9px] font-bold uppercase tracking-wider',
            on ? 'text-[#f5c518]' : 'text-red-300',
          )}
        >
          {on ? 'IA SDR Ativa' : 'IA SDR Pausada'}
        </span>
      </div>
      <div
        className={cn(
          'w-8 h-4 rounded-full relative transition-colors',
          on ? 'bg-[#f5c518]' : 'bg-red-500/70',
        )}
      >
        <div
          className={cn(
            'absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all',
            on ? 'right-0.5' : 'left-0.5',
          )}
        />
      </div>
    </button>
  );
};

/* ============ MOBILE DRAWER ============ */
const MobileDrawer = ({
  items,
  pathname,
  user,
  onLogout,
  open,
  onOpenChange,
}: {
  items: NavItem[];
  pathname: string;
  user: any;
  onLogout: () => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[300px] max-w-[85vw] bg-[#0f172a] border-r border-white/5 p-0 flex flex-col"
      >
        <div className="p-4 border-b border-white/5">
          <Logo />
        </div>

        <div className="flex-1 overflow-y-auto thin-scrollbar p-3 space-y-1">
          {items.map((item) => {
            if (isGroup(item)) {
              const isExp = expanded[item.label] ?? isItemActive(item, pathname);
              const Icon = item.icon;
              return (
                <div key={item.label}>
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [item.label]: !isExp }))}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors duration-150"
                  >
                    <span className="flex items-center gap-3">
                      {Icon && <Icon className="w-4 h-4" />}
                      {item.label}
                    </span>
                    <ChevronDown className={cn('w-4 h-4 transition-transform duration-150', isExp && 'rotate-180')} />
                  </button>
                  {isExp && (
                    <div className="ml-3 mt-1 mb-1 pl-3 border-l border-white/10 space-y-0.5">
                      {item.children.map((c) => {
                        const CIcon = c.icon;
                        const active = pathname === c.href;
                        return (
                          <Link
                            key={c.label + c.href}
                            to={c.href}
                            onClick={() => onOpenChange(false)}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150',
                              active
                                ? 'bg-[#1e293b] text-[#f5c518] font-semibold [&_svg]:text-[#f5c518]'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white',
                            )}
                          >
                            <CIcon className="w-4 h-4" />
                            {c.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.label + item.href}
                to={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
                  active
                    ? 'bg-[#1e293b] text-[#f5c518] [&_svg]:text-[#f5c518]'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}

          <div className="pt-4 mt-2 border-t border-white/5">
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/5">
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold text-white">Monitoramento</span>
                <span className="text-[10px] font-bold text-[#f5c518] uppercase tracking-wider">IA SDR Ativa</span>
              </div>
              <div className="w-9 h-5 bg-[#f5c518] rounded-full relative">
                <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-white/5 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-[#f5c518]/40"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f5c518] to-[#d4a900] flex items-center justify-center text-[#0f172a] font-bold text-sm">
                {user.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider truncate">{user.role}</p>
            </div>
          </div>
          <button
            onClick={() => { onOpenChange(false); onLogout(); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-[#ef4444] bg-[#ef4444]/10 hover:bg-[#ef4444]/20 transition-colors duration-150"
          >
            <LogOut className="w-4 h-4" />
            Encerrar sessão
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

/* ============ APP LAYOUT ============ */
const AppLayout = () => {
  const { user, loading, logout, initialize } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    console.log('[layout] 🚀 mount → initialize()');
    initialize();
  }, []);

  useEffect(() => {
    if (loading || user || location.pathname === '/login') return;
    // Decisão 100% síncrona (sem getSession(), que pode travar após F5 por
    // causa do lock de auth do navegador):
    //  - sem sessão salva no localStorage → /login
    //  - com sessão salva mas sem user no store → monta user fallback para
    //    nunca deixar o spinner infinito.
    const local = readLocalSession();
    if (!local) {
      navigate({ to: '/login' });
    } else {
      useAuthStore.getState().setUser(buildFallbackUser(local.userId, local.email));
    }
  }, [loading, user, location.pathname]);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const isSuperAdmin = user?.role === 'super_admin';
  const { can } = usePermissions();
  const rawItems = useNavItems(isSuperAdmin);
  const items = filterItems(rawItems, can);

  // Guard: se a rota atual não está permitida, redireciona para /
  useEffect(() => {
    if (!user || loading) return;
    if (user.role === 'super_admin' || user.role === 'admin') return;
    const moduleForPath = (() => {
      for (const i of rawItems) {
        if (isGroup(i)) {
          for (const c of i.children) if (c.href === location.pathname) return c.module;
        } else if (i.href === location.pathname) return i.module;
      }
      return undefined;
    })();
    if (moduleForPath && !can(moduleForPath)) navigate({ to: '/' });
  }, [location.pathname, user, loading]);

  // Mostra spinner enquanto:
  //  - a auth ainda está inicializando (loading), OU
  //  - não há user mas estamos numa rota protegida (evita renderizar o conteúdo
  //    sem o header/menu durante a janela entre Ctrl+Shift+R e o restore da sessão).
  // O effect acima cuida de redirecionar p/ /login se realmente não há sessão.
  if (loading || (!user && location.pathname !== '/login'))
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (!user) return <Outlet />;
  
  

  // Items priorizados para tablet (esconder Marketing e itens menos prioritários)
  const tabletHide = new Set(['Marketing']);

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 font-jakarta">
      {/* HEADER FIXO */}
      <header className="fixed top-0 inset-x-0 h-14 bg-[#0f172a] z-50 border-b border-white/5">
        <div className="h-full px-4 lg:px-6 flex items-center gap-4">
          {/* Esquerda: Logo + Hambúrguer mobile */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-white hover:bg-white/5 transition-colors duration-150"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/" className="flex items-center">
              <Logo />
            </Link>
          </div>

          {/* Centro: Navegação desktop */}
          <nav className="hidden lg:flex items-center gap-1 mx-auto">
            {items.map((item) => {
              if (isGroup(item)) {
                if (tabletHide.has(item.label)) {
                  return (
                    <div key={item.label} className="hidden xl:block">
                      <NavDropdown group={item} pathname={location.pathname} />
                    </div>
                  );
                }
                return <NavDropdown key={item.label} group={item} pathname={location.pathname} />;
              }
              const Icon = item.icon;
              const active = isItemActive(item, location.pathname);
              const wrapHidden = tabletHide.has(item.label) ? 'hidden xl:flex' : 'flex';
              return (
                <Link
                  key={item.label + item.href}
                  to={item.href}
                  className={cn(
                    wrapHidden,
                    'items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-all duration-150 ease-in-out',
                    active
                      ? 'bg-[#1e293b] text-[#f5c518] [&_svg]:text-[#f5c518]'
                      : 'text-slate-400 hover:text-white',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Direita: Ações */}
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <AiToggle />
            <div className="text-white">
              <NotificationCenter />
            </div>
            <UserMenu user={user} onLogout={logout} />
          </div>
        </div>
      </header>

      {/* Drawer mobile */}
      <MobileDrawer
        items={items}
        pathname={location.pathname}
        user={user}
        onLogout={logout}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      {/* Conteúdo */}
      <main
        className="pt-14 min-h-screen pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0"
      >
        {location.pathname === '/chat' ? (
          <div className="w-full px-2 sm:px-3 md:px-4">
            <Outlet />
          </div>
        ) : (
          <div className="max-w-[1600px] mx-auto w-full p-3 sm:p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        )}
      </main>

      {/* Bottom nav mobile */}
      <MobileBottomNav pathname={location.pathname} />
    </div>
  );
};

export default AppLayout;
