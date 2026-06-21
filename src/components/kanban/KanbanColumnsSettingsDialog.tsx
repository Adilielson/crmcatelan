/** @jsxImportSource react */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GripVertical, Trash2, Plus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  KanbanColumn,
  useCreateKanbanColumn,
  useDeleteKanbanColumn,
  useReorderKanbanColumns,
  useUpdateKanbanColumn,
} from '@/hooks/use-kanban-columns';
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#22c55e', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#6366f1', '#64748b',
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  columns: KanbanColumn[];
  groupLabel?: string;
}

export function KanbanColumnsSettingsDialog({ open, onOpenChange, columns, groupLabel = 'Prospeccao' }: Props) {
  const [localOrder, setLocalOrder] = useState<KanbanColumn[]>(columns);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const dirtyRef = useRef(false);

  const reorder = useReorderKanbanColumns();
  const update = useUpdateKanbanColumn();
  const create = useCreateKanbanColumn();
  const remove = useDeleteKanbanColumn();

  // Sync with server when not actively editing
  useEffect(() => {
    if (!dirtyRef.current) setLocalOrder(columns);
  }, [columns]);

  useEffect(() => {
    if (open) {
      dirtyRef.current = false;
      setLocalOrder(columns);
    }
  }, [open]);

  const nextPosition = useMemo(() => {
    const max = columns.reduce((m, c) => Math.max(m, c.position), 0);
    return max + 10;
  }, [columns]);

  const handleDragStart = (id: string) => () => setDraggingId(id);
  const handleDragOver = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setOverId(id);
  };
  const handleDrop = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingId || draggingId === id) {
      setDraggingId(null);
      setOverId(null);
      return;
    }
    const next = [...localOrder];
    const from = next.findIndex((c) => c.id === draggingId);
    const to = next.findIndex((c) => c.id === id);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setLocalOrder(next);
    setDraggingId(null);
    setOverId(null);
    dirtyRef.current = true;
    reorder.mutate(next.map((c) => c.id), {
      onSuccess: () => {
        dirtyRef.current = false;
      },
    });
  };

  const handleRename = (col: KanbanColumn, value: string) => {
    setLocalOrder((prev) => prev.map((c) => (c.id === col.id ? { ...c, name: value } : c)));
  };

  const commitRename = (col: KanbanColumn, value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === col.name) return;
    update.mutate({ id: col.id, updates: { name: trimmed } });
  };

  const handleColorChange = (col: KanbanColumn, color: string) => {
    setLocalOrder((prev) => prev.map((c) => (c.id === col.id ? { ...c, color } : c)));
    update.mutate({ id: col.id, updates: { color } });
  };

  const handleDelete = (col: KanbanColumn) => {
    if (col.is_system) {
      toast.error('Colunas do sistema não podem ser excluídas');
      return;
    }
    if (!confirm(`Excluir a etapa "${col.name}"? Os leads desta etapa voltarão para Leads Prontos.`)) return;
    remove.mutate(col.id);
  };

  const handleAdd = () => {
    create.mutate({ name: 'Nova etapa', color: PRESET_COLORS[0], position: nextPosition });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] bg-[#F6F7F9] border-[#E3E6EB] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-sm font-black uppercase tracking-[0.18em] text-[#6C727C] font-jakarta">
            Etapas de <span className="text-[#FF8A00] normal-case tracking-normal">{groupLabel}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-2.5 max-h-[70vh] overflow-y-auto">
          {localOrder.map((col) => {
            const isDragging = draggingId === col.id;
            const isOver = overId === col.id && draggingId !== col.id;
            return (
              <div
                key={col.id}
                draggable
                onDragStart={handleDragStart(col.id)}
                onDragOver={handleDragOver(col.id)}
                onDrop={handleDrop(col.id)}
                onDragEnd={() => { setDraggingId(null); setOverId(null); }}
                className={cn(
                  'group flex items-center gap-3 bg-white border border-[#E3E6EB] rounded-[12px] px-3 py-2.5 shadow-sm transition-all',
                  isDragging && 'opacity-50',
                  isOver && 'ring-2 ring-[#FFC400] border-[#FFC400]',
                )}
              >
                <button
                  type="button"
                  className="cursor-grab active:cursor-grabbing text-[#A7ADB8] hover:text-ink shrink-0"
                  aria-label="Arrastar para reordenar"
                >
                  <GripVertical className="w-4 h-4" />
                </button>

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10 hover:scale-110 transition"
                      style={{ backgroundColor: col.color }}
                      aria-label="Mudar cor"
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <div className="flex flex-wrap gap-1.5 max-w-[180px]">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleColorChange(col, c)}
                          className={cn(
                            'w-6 h-6 rounded-md border-2 transition-all',
                            col.color === c ? 'border-foreground scale-110' : 'border-transparent',
                          )}
                          style={{ backgroundColor: c }}
                          aria-label={`Cor ${c}`}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Input
                  value={col.name}
                  onChange={(e) => handleRename(col, e.target.value)}
                  onBlur={(e) => commitRename(col, e.target.value)}
                  disabled={col.is_system}
                  maxLength={40}
                  className="flex-1 h-9 border-none shadow-none focus-visible:ring-0 px-1 text-sm font-semibold text-ink bg-transparent"
                />

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6C727C] bg-[#F6F7F9] border border-[#E3E6EB] rounded-md px-2 py-1">
                    Estag.
                    <ChevronDown className="w-3 h-3" />
                  </span>
                  <span className="text-[11px] font-bold text-[#6C727C] tabular-nums w-5 text-center">
                    {col.position / 10 || '—'}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-[#A7ADB8] font-bold">dias</span>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[#A7ADB8] hover:text-red-600 hover:bg-red-50 shrink-0"
                  onClick={() => handleDelete(col)}
                  disabled={col.is_system}
                  aria-label="Excluir etapa"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAdd}
            disabled={create.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[12px] border border-dashed border-[#C7CDD6] text-[#6C727C] hover:border-[#FFC400] hover:text-ink hover:bg-white transition-all text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> Nova Etapa
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
