import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Users, Calendar, CheckCircle2, FileBarChart, XCircle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/relatorios')({
  component: RelatoriosLayout,
});

const items = [
  {
    label: 'Atendentes',
    description: 'Performance por atendente',
    href: '/relatorios/atendentes',
    icon: Users,
  },
  {
    label: 'Agendamentos',
    description: 'Funil e conversão de agendamentos',
    href: '/relatorios/agendamentos',
    icon: Calendar,
  },
  {
    label: 'Comparecimento',
    description: 'Comparecimento e no-show',
    href: '/relatorios/comparecimento',
    icon: CheckCircle2,
  },
  {
    label: 'Leads Perdidos',
    description: 'Motivos e detalhamento de perdas',
    href: '/relatorios/perdidos',
    icon: XCircle,
  },
  {
    label: 'LTV',
    description: 'Compras, recorrência e top clientes',
    href: '/relatorios/ltv',
    icon: TrendingUp,
  },
];

function RelatoriosLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-[calc(100vh-3rem)] w-full">
      <aside className="w-64 shrink-0 border-r bg-muted/30 p-4">
        <div className="mb-4 flex items-center gap-2 px-2">
          <FileBarChart className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold">Relatórios</h2>
        </div>
        <nav className="space-y-1">
          {items.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-start gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground/80 hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.description}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
