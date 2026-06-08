import React from 'react';
import { useAuthStore } from '@/hooks/use-auth';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  Calendar, 
  Settings, 
  LogOut,
  Columns,
  Target,
  ShieldCheck,
  Brain,
  TrendingDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, Outlet, useLocation } from '@tanstack/react-router';
import { NotificationCenter } from './NotificationCenter';

const AppLayout = () => {
  const { user, tenant, logout } = useAuthStore();
  const location = useLocation();

  const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
    { label: 'Performance', icon: Target, href: '/performance' },
    { label: 'Métricas No-Show', icon: TrendingDown, href: '/analytics/no-show' },
    { label: 'Treinamento IA', icon: Brain, href: '/ai-training' },
    { label: 'Kanban', icon: Columns, href: '/kanban' },
    { label: 'Chat', icon: MessageSquare, href: '/chat' },
    { label: 'Agenda', icon: Calendar, href: '/agenda' },
    { label: 'Marketing', icon: Target, href: '/marketing' },
    { label: 'Usuários', icon: Users, href: '/users' },
    { label: 'Configurações', icon: Settings, href: '/settings' },
  ];

  // Adicionar Parceiro de Marketing para visualização/teste
  if (user?.role === 'marketing_partner') {
    // Para parceiros de marketing, talvez queiramos simplificar o menu
    // Mas conforme solicitado, é uma aba restrita no CRM atual
  }

  // Menu especial para Super Admin
  if (user?.role === 'super_admin') {
    menuItems.push({ label: 'Admin SaaS', icon: ShieldCheck, href: '/saas' });
  }

  if (!user) return <Outlet />;

  return (
    <div className="flex h-screen bg-slate-50/50">
      <aside className="w-64 bg-white border-r border-slate-200/60 flex flex-col shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Castelar CRM
          </h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-70">
            {tenant?.name || "Unidade Gestão"}
          </p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group",
                  isActive 
                    ? "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20" 
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                )}
              >
                <item.icon className={cn(
                  "w-4 h-4 transition-colors",
                  isActive ? "text-primary-foreground" : "text-slate-400 group-hover:text-slate-900"
                )} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-white rounded-xl border border-slate-200/60 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            ENCERRAR SESSÃO
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto flex flex-col">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center px-8 sticky top-0 z-10">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
            {menuItems.find(i => i.href === location.pathname)?.label || 'Painel'}
          </h2>
          <div className="ml-auto flex items-center gap-4">
            <div className="h-8 w-[1px] bg-slate-200 mx-2" />
            <NotificationCenter />
          </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
