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
    <div className="flex h-screen bg-[#0E0E11] relative z-10">
      <aside className="w-64 bg-[#0E0E11] border-r border-[#23232B] flex flex-col">
        <div className="p-6 border-b border-[#23232B]">
          <div className="flex items-center gap-3 mb-4">
             <svg className="w-8 h-4 text-[#FFC400]" viewBox="0 0 60 28"><path d="M3 8 Q3 4 8 4 L24 4 Q28 4 28 9 L28 16 Q28 23 19 23 L11 23 Q3 23 3 14 Z M32 8 Q32 4 37 4 L53 4 Q57 4 57 9 L57 14 Q57 23 49 23 L41 23 Q32 23 32 16 Z M28 9 L32 9" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/></svg>
             <h1 className="text-sm font-black text-white tracking-[0.04em] font-jakarta leading-none pt-1">ÓTICA CATELAN</h1>
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-70">
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
                  "flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] transition-all duration-200 group font-jakarta font-semibold",
                  isActive 
                    ? "bg-[#FFC400] text-[#1a1500] shadow-md shadow-[#FFC400]/10" 
                    : "text-[#A9ABB3] hover:bg-[#1f1f27] hover:text-white"
                )}
              >
                <item.icon className={cn(
                  "w-4 h-4 transition-colors",
                  isActive ? "text-[#1a1500]" : "text-slate-500 group-hover:text-white"
                )} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#23232B] bg-[#0E0E11]">
          <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-[#17171B] rounded-[14px] border border-[#23232B]">
            <div className="w-9 h-9 rounded-full bg-[#FFC400] flex items-center justify-center text-[#1a1500] font-bold text-sm font-jakarta">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold text-white truncate font-jakarta">{user.name}</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-xs font-bold text-[#D64545] hover:bg-[#FBEBEB]/10 rounded-[8px] transition-colors font-jakarta"
          >
            <LogOut className="w-4 h-4" />
            ENCERRAR SESSÃO
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto flex flex-col bg-[#F6F7F9]">
        <header className="h-16 bg-[#0E0E11] border-b border-[#23232B] flex items-center px-8 sticky top-0 z-10">
          <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-widest font-jakarta">
            {menuItems.find(i => i.href === location.pathname)?.label || 'Painel'}
          </h2>
          <div className="ml-auto flex items-center gap-4">
            <div className="nav-ai flex items-center gap-10 bg-[#1c1c24] border border-[#23232B] rounded-full px-4 py-2">
              <div className="flex flex-col">
                 <span className="text-[12px] font-bold text-white leading-tight">Pré-atendimento</span>
                 <span className="text-[10px] font-bold text-[#FFC400] leading-tight">com IA</span>
              </div>
              <div className="w-10 h-5 bg-[#FFC400] rounded-full relative cursor-pointer">
                 <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
            <div className="h-8 w-[1px] bg-[#23232B] mx-2" />
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
