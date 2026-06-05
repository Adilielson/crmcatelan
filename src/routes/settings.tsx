import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

function Settings() {
  return (
    <div className="max-w-4xl space-y-6">
      <section className="bg-white border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Treinamento da IA SDR</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Configure como a IA deve se comportar e qual base de conhecimento ela deve usar.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Tom de Voz</label>
            <select className="w-full bg-white border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary">
              <option>Consultivo e Amigável</option>
              <option>Formal e Profissional</option>
              <option>Direto e Objetivo</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium block mb-1">Instruções de Comportamento (System Prompt)</label>
            <textarea 
              className="w-full bg-white border rounded-lg px-3 py-2 text-sm h-32 outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ex: Você é uma assistente da Ótica Castelar. Seu objetivo é qualificar o lead e agendar uma consulta..."
            />
          </div>

          <div className="pt-4 border-t flex justify-end">
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">
              Salvar Alterações
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Configurações da Unidade</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Nome da Loja</label>
            <input type="text" className="w-full bg-white border rounded-lg px-3 py-2 text-sm" defaultValue="Ótica Castelar Matriz" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">WhatsApp de Atendimento</label>
            <input type="text" className="w-full bg-white border rounded-lg px-3 py-2 text-sm" placeholder="+55..." />
          </div>
        </div>
      </section>
    </div>
  )
}
