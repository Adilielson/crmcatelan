import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/users')({
  component: Users,
})

function Users() {
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="p-6 border-b flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Equipe</h3>
          <p className="text-sm text-muted-foreground">Gerencie os acessos da sua ótica</p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">
          Convidar Usuário
        </button>
      </div>
      <table className="w-full text-left">
        <thead className="bg-gray-50 text-xs font-medium text-muted-foreground uppercase">
          <tr>
            <th className="px-6 py-4">Nome</th>
            <th className="px-6 py-4">Email</th>
            <th className="px-6 py-4">Cargo</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y text-sm">
          <tr>
            <td className="px-6 py-4 font-medium text-gray-900">Admin Castelar</td>
            <td className="px-6 py-4 text-muted-foreground">admin@castelar.com</td>
            <td className="px-6 py-4">
              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">Administrador</span>
            </td>
            <td className="px-6 py-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" /> Ativo
              </span>
            </td>
            <td className="px-6 py-4 text-right">
              <button className="text-muted-foreground hover:text-primary transition-colors">Editar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
