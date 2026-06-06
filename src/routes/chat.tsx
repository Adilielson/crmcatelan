import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, User, Send, Phone, Info } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/chat')({
  component: Chat,
})

const contacts = [
  { id: 1, name: 'João Silva', lastMessage: 'Olá, gostaria de saber mais...', time: '10:30', unread: 2, status: 'online' },
  { id: 2, name: 'Maria Souza', lastMessage: 'Pode agendar para amanhã?', time: '09:15', unread: 0, status: 'offline' },
]

function Chat() {
  const [selectedContact, setSelectedContact] = useState(contacts[0])

  return (
    <div className="bg-white border rounded-xl h-[calc(100vh-140px)] flex overflow-hidden">
      {/* Coluna 1: Contatos */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <input 
            type="text" 
            placeholder="Buscar conversas..." 
            className="w-full bg-gray-100 border-none rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {contacts.map(contact => (
            <div 
              key={contact.id} 
              onClick={() => setSelectedContact(contact)}
              className={`p-4 border-b cursor-pointer hover:bg-gray-50 flex gap-3 ${selectedContact?.id === contact.id ? 'bg-primary/5' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center relative">
                <User className="w-6 h-6 text-gray-400" />
                {contact.status === 'online' && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h4 className="font-medium text-sm truncate">{contact.name}</h4>
                  <span className="text-[10px] text-muted-foreground">{contact.time}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{contact.lastMessage}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coluna 2: Chat */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedContact ? (
          <>
            <div className="p-4 border-b bg-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <span className="font-medium text-sm">{selectedContact.name}</span>
              </div>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg"><Phone className="w-4 h-4 text-muted-foreground" /></button>
                <button className="p-2 hover:bg-gray-100 rounded-lg"><Info className="w-4 h-4 text-muted-foreground" /></button>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              <div className="flex justify-start">
                <div className="bg-white border p-3 rounded-2xl rounded-tl-none max-w-[80%] shadow-sm">
                  <p className="text-sm">{selectedContact.lastMessage}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground p-3 rounded-2xl rounded-tr-none max-w-[80%] shadow-sm">
                  <p className="text-sm">Olá João! Claro, posso te ajudar. Qual seria sua dúvida específica?</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white border-t">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Digite sua mensagem..." 
                  className="flex-1 bg-gray-100 border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary"
                />
                <button className="bg-primary text-primary-foreground p-2 rounded-lg">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Selecione uma conversa para começar</p>
          </div>
        )}
      </div>

      {/* Coluna 3: Dados do Lead & Qualificação IA */}
      <div className="w-80 border-l bg-white overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground">Dados do Lead</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Valor do Negócio</label>
              <div className="flex gap-2 mt-1">
                <span className="text-sm font-semibold">R$</span>
                <input type="text" defaultValue="2.500,00" className="w-full text-sm font-semibold border-b focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Origem</label>
              <div className="text-sm">WhatsApp Business</div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground">Checklist de Qualificação IA</h3>
          <div className="space-y-3">
            {[
              { label: 'Intenção de compra', status: 'checked' },
              { label: 'Orçamento definido', status: 'checked' },
              { label: 'Prazo para fechamento', status: 'unchecked' },
              { label: 'Necessidades técnicas', status: 'checked' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className={`w-5 h-5 ${item.status === 'checked' ? 'text-green-500 fill-green-50' : 'text-gray-300'}`} />
                <span className={`text-sm ${item.status === 'checked' ? 'text-gray-900' : 'text-gray-400'}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t">
          <button className="w-full bg-primary/10 text-primary py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors">
            Ver Perfil Completo
          </button>
        </div>
      </div>
    </div>
  )
}
