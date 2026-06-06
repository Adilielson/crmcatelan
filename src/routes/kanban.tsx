import { createFileRoute } from '@tanstack/react-router'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'

export const Route = createFileRoute('/kanban')({
  component: Kanban,
})

function Kanban() {
  return (
    <div className="p-6">
      <KanbanBoard />
    </div>
  )
}

