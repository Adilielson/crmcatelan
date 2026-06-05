import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/chat')({
  component: Chat,
})

function Chat() {
  return (
    <div className="bg-white border rounded-xl h-[calc(100vh-200px)] flex overflow-hidden">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <input 
            type="text" 
            placeholder="Buscar conversas..." 
            className="w-full bg-gray-100 border-none rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <p className="text-xs text-center text-muted-foreground py-10">Nenhuma conversa ativa</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-gray-50">
        <p>Selecione uma conversa para começar</p>
      </div>
    </div>
  )
}
