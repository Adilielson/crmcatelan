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
  TrendingDown,
  Smartphone,
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
    { label: 'WhatsApp', icon: Smartphone, href: '/whatsapp' },
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
    <div className="flex h-screen bg-[#F6F7F9] relative z-10 text-ink font-jakarta">
      <aside className="w-64 bg-[#0E0E11] border-r border-[#23232B] flex flex-col shrink-0">
        <div className="p-8 border-b border-[#23232B]">
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2 bg-[#FFC400]/10 rounded-xl">
               <svg className="w-8 h-4 text-[#FFC400]" viewBox="0 0 60 28"><path d="M3 8 Q3 4 8 4 L24 4 Q28 4 28 9 L28 16 Q28 23 19 23 L11 23 Q3 23 3 14 Z M32 8 Q32 4 37 4 L53 4 Q57 4 57 9 L57 14 Q57 23 49 23 L41 23 Q32 23 32 16 Z M28 9 L32 9" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/></svg>
             </div>
             <h1 className="text-[15px] font-black text-white tracking-[0.05em] leading-tight pt-1">ÓTICA CATELAN</h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#17171B] border border-[#23232B] rounded-full w-fit">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FFC400] animate-pulse" />
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
              {tenant?.name || "Unidade Gestão"}
            </p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-[12px] text-[13px] transition-all duration-300 group font-semibold",
                  isActive 
                    ? "bg-[#FFC400] text-[#1a1500] shadow-[0_4px_12px_rgba(255,196,0,0.15)] scale-[1.02]" 
                    : "text-slate-400 hover:bg-[#17171B] hover:text-white"
                )}
              >
                <item.icon className={cn(
                  "w-[18px] h-[18px] transition-transform duration-300",
                  isActive
                    ? "text-[#1a1500]"
                    : item.href === '/whatsapp'
                    ? "text-green-400 group-hover:text-green-300 group-hover:scale-110"
                    : "text-slate-500 group-hover:text-white group-hover:scale-110"
                )} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-[#23232B] bg-[#0E0E11]">
          <div className="flex items-center gap-3 mb-6 px-3 py-3 bg-[#17171B] rounded-[14px] border border-[#23232B]">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFC400] to-[#E0A500] flex items-center justify-center text-[#1a1500] font-black text-base shadow-lg shadow-black/20">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[13px] font-black text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center justify-center gap-3 px-4 py-3 w-full text-[11px] font-black text-[#D64545] hover:bg-[#D64545]/10 rounded-[12px] transition-all border border-transparent hover:border-[#D64545]/20"
          >
            <LogOut className="w-4 h-4" />
            ENCERRAR SESSÃO
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto flex flex-col relative">
        <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-[#E3E6EB] flex items-center px-10 sticky top-0 z-50">
          <div className="flex flex-col">
            <h2 className="text-[11px] font-black text-[#A7ADB8] uppercase tracking-[0.25em] leading-none mb-1">
              Plataforma Integrada
            </h2>
            <p className="text-[16px] font-black text-ink leading-none">
              {menuItems.find(i => i.href === location.pathname)?.label || 'Painel Principal'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-6">
            <div className="nav-ai flex items-center gap-8 bg-[#F6F7F9] border border-[#E3E6EB] rounded-full px-5 py-2.5 transition-all hover:border-primary/30 group cursor-pointer">
              <div className="flex flex-col">
                 <span className="text-[11px] font-black text-ink leading-tight">Monitoramento</span>
                 <span className="text-[10px] font-bold text-primary leading-tight uppercase tracking-wider">IA SDR Ativa</span>
              </div>
              <div className="w-10 h-5 bg-[#FFC400] rounded-full relative shadow-sm group-hover:shadow-[#FFC400]/20">
                 <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-md" />
              </div>
            </div>
            <div className="h-8 w-[1px] bg-[#E3E6EB]" />
            <NotificationCenter />
          </div>
        </header>
        <div className="p-10 max-w-[1600px] mx-auto w-full flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
