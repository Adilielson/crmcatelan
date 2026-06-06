import { createFileRoute } from '@tanstack/react-router'
import { Calendar, MessageSquare, MapPin, DollarSign, Instagram, Mail, Globe, MessageCircle } from 'lucide-react'

export const Route = createFileRoute('/kanban')({
  component: Kanban,
})

const leads = [
  { id: 1, name: 'João Silva', value: 'R$ 2.500', source: 'whatsapp', status: 'Leads Prontos' },
  { id: 2, name: 'Maria Souza', value: 'R$ 4.200', source: 'instagram', status: 'Em Atendimento' },
]

function Kanban() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Pipeline de Vendas</h3>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">
          Novo Lead
        </button>
      </div>
      
      <div className="flex gap-6 overflow-x-auto pb-4">
        {['Leads Prontos', 'Em Atendimento', 'Agendado', 'Perdido'].map((column) => (
          <div key={column} className="min-w-[300px] flex-1">
            <div className="bg-gray-100 p-4 rounded-t-xl border-t border-x flex justify-between items-center">
              <span className="font-medium text-sm">{column}</span>
              <span className="bg-white px-2 py-0.5 rounded text-xs text-muted-foreground border">
                {leads.filter(l => l.status === column).length}
              </span>
            </div>
            <div className="bg-gray-50/50 p-4 rounded-b-xl border min-h-[500px] space-y-3">
              {leads.filter(l => l.status === column).map(lead => (
                <div key={lead.id} className="bg-white p-4 rounded-lg border shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-sm">{lead.name}</h4>
                      <p className="text-sm text-primary font-semibold">{lead.value}</p>
                    </div>
                    {lead.source === 'whatsapp' && <MessageCircle className="w-4 h-4 text-green-500" />}
                    {lead.source === 'instagram' && <Instagram className="w-4 h-4 text-pink-500" />}
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <button className="p-2 hover:bg-gray-100 rounded-lg text-muted-foreground" title="Agenda">
                      <Calendar className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg text-muted-foreground" title="WhatsApp">
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg text-muted-foreground" title="Localização">
                      <MapPin className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg text-muted-foreground" title="Venda Fechada">
                      <DollarSign className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
