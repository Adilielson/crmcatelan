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

  // Menu especial para Super Admin
  if (user?.role === 'super_admin') {
    menuItems.push({ label: 'Admin SaaS', icon: ShieldCheck, href: '/saas' });
  }

  if (!user) return <Outlet />;

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-primary">Castelar CRM</h1>
          <p className="text-xs text-muted-foreground truncate">{tenant?.name}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground font-medium" 
                    : "text-muted-foreground hover:bg-gray-100"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-4 px-3">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 w-full text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="h-16 bg-white border-b flex items-center px-8 sticky top-0 z-10">
          <h2 className="text-lg font-semibold">
            {menuItems.find(i => i.href === location.pathname)?.label || 'Painel'}
          </h2>
        </header>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
