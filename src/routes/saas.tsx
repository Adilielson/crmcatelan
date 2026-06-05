import { createFileRoute } from '@tanstack/react-router'
import { Building2, CreditCard, Activity, Cpu } from 'lucide-react'

export const Route = createFileRoute('/saas')({
  component: SaaSAdmin,
})

function SaaSAdmin() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 border rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Total de Óticas</span>
          </div>
          <p className="text-xl font-bold">24</p>
        </div>
        <div className="bg-white p-4 border rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-muted-foreground">MRR Total</span>
          </div>
          <p className="text-xl font-bold">R$ 12.400</p>
        </div>
        <div className="bg-white p-4 border rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium text-muted-foreground">Tokens IA (Mês)</span>
          </div>
          <p className="text-xl font-bold">840k</p>
        </div>
        <div className="bg-white p-4 border rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-muted-foreground">Saúde do Sistema</span>
          </div>
          <p className="text-xl font-bold text-green-600">Excelente</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Lista de Inquilinos (Tenants)</h3>
        </div>
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-6 py-3">Ótica</th>
              <th className="px-6 py-3">Plano</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Leads/Mês</th>
              <th className="px-6 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            <tr>
              <td className="px-6 py-4 font-medium">Ótica Castelar Matriz</td>
              <td className="px-6 py-4">Pro Plan</td>
              <td className="px-6 py-4">
                <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">ATIVO</span>
              </td>
              <td className="px-6 py-4">450 / 1000</td>
              <td className="px-6 py-4 text-right">
                <button className="text-primary hover:underline">Gerenciar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
