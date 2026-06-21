/** @jsxImportSource react */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GripVertical, Trash2, Plus, X, Minus, ArrowLeft } from 'lucide-react';
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
  '#0ea5e9', '#84cc16', '#eab308', '#f97316', '#d946ef',
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

  useEffect(() => {
    if (!dirtyRef.current) setLocalOrder(columns);
  }, [columns]);

  useEffect(() => {
    if (open) {
      dirtyRef.current = false;
      setLocalOrder(columns);
      document.body.style.overflow = 'hidden';
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onOpenChange(false);
      };
      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('keydown', onKey);
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
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
      setDraggingId(null); setOverId(null);
      return;
    }
    const next = [...localOrder];
    const from = next.findIndex((c) => c.id === draggingId);
    const to = next.findIndex((c) => c.id === id);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setLocalOrder(next);
    setDraggingId(null); setOverId(null);
    dirtyRef.current = true;
    reorder.mutate(next.map((c) => c.id), {
      onSuccess: () => { dirtyRef.current = false; },
    });
  };

  const handleRename = (col: KanbanColumn, value: string) => {
    setLocalOrder((prev) => prev.map((c) => (c.id === col.id ? { ...c, name: value } : c)));
  };
  const commitRename = (col: KanbanColumn, value: string) => {
    const trimmed = value.trim();
    const original = columns.find((c) => c.id === col.id);
    if (!trimmed) {
      if (original) setLocalOrder((prev) => prev.map((c) => (c.id === col.id ? { ...c, name: original.name } : c)));
      return;
    }
    if (original && trimmed === original.name) return;
    dirtyRef.current = true;
    update.mutate(
      { id: col.id, updates: { name: trimmed } },
      { onSuccess: () => { dirtyRef.current = false; toast.success('Etapa renomeada'); } },
    );
  };

  const handleColorChange = (col: KanbanColumn, color: string) => {
    setLocalOrder((prev) => prev.map((c) => (c.id === col.id ? { ...c, color } : c)));
    dirtyRef.current = true;
    update.mutate(
      { id: col.id, updates: { color } },
      { onSuccess: () => { dirtyRef.current = false; } },
    );
  };

  const handleDaysChange = (col: KanbanColumn, value: number) => {
    const days = Math.max(0, Math.min(365, Math.round(value || 0)));
    setLocalOrder((prev) => prev.map((c) => (c.id === col.id ? { ...c, sla_days: days } : c)));
  };
  const commitDays = (col: KanbanColumn, value: number) => {
    const days = Math.max(0, Math.min(365, Math.round(value || 0)));
    const original = columns.find((c) => c.id === col.id);
    if (original && days === original.sla_days) return;
    dirtyRef.current = true;
    update.mutate(
      { id: col.id, updates: { sla_days: days } },
      { onSuccess: () => { dirtyRef.current = false; } },
    );
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#F6F7F9] animate-in fade-in duration-200 overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#E3E6EB] shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="group flex items-center gap-2 h-11 pl-2 pr-3 rounded-xl border border-[#E3E6EB] bg-white hover:bg-[#F6F7F9] hover:border-[#C7CDD6] text-[#3a414c] hover:text-ink transition-all shadow-sm"
              aria-label="Voltar para o Kanban"
              title="Voltar (Esc)"
            >
              <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#F6F7F9] group-hover:bg-white transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </span>
              <span className="text-sm font-bold hidden sm:inline">Voltar</span>
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#6C727C] font-jakarta truncate">
                Etapas de <span className="text-[#FF8A00] normal-case tracking-normal">{groupLabel}</span>
              </h2>
              <p className="text-xs text-[#A7ADB8] mt-1 font-semibold hidden sm:block">
                Edite nome, cor e SLA em dias. Arraste para reordenar — tudo é salvo automaticamente.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-11 w-11 rounded-xl hover:bg-[#F6F7F9] text-[#6C727C] hover:text-ink shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-3">
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
                'group flex items-center gap-3 bg-white border border-[#E3E6EB] rounded-[14px] px-4 py-3 shadow-sm transition-all',
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

              {/* Color */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-4 h-4 rounded-full shrink-0 border border-black/10 hover:scale-110 transition"
                    style={{ backgroundColor: col.color }}
                    aria-label="Mudar cor"
                  />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="grid grid-cols-5 gap-1.5 w-[160px]">
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

              {/* Name */}
              <Input
                value={col.name}
                onChange={(e) => handleRename(col, e.target.value)}
                onBlur={(e) => commitRename(col, e.target.value)}
                disabled={col.is_system}
                maxLength={40}
                className="flex-1 h-10 border-none shadow-none focus-visible:ring-0 px-2 text-sm font-semibold text-ink bg-transparent"
              />

              {/* Days control */}
              <div className="flex items-center gap-1 shrink-0 bg-[#F6F7F9] border border-[#E3E6EB] rounded-lg px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => {
                    handleDaysChange(col, col.sla_days - 1);
                    commitDays(col, col.sla_days - 1);
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-[#6C727C] hover:bg-white hover:text-ink"
                  aria-label="Diminuir dias"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={col.sla_days}
                  onChange={(e) => handleDaysChange(col, Number(e.target.value))}
                  onBlur={(e) => commitDays(col, Number(e.target.value))}
                  className="w-9 h-6 bg-transparent text-center text-xs font-bold text-ink tabular-nums focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    handleDaysChange(col, col.sla_days + 1);
                    commitDays(col, col.sla_days + 1);
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-[#6C727C] hover:bg-white hover:text-ink"
                  aria-label="Aumentar dias"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <span className="text-[10px] uppercase tracking-wider text-[#A7ADB8] font-bold pl-1 pr-1">
                  dias
                </span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-[#A7ADB8] hover:text-red-600 hover:bg-red-50 shrink-0 disabled:opacity-30"
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
          className="w-full flex items-center justify-center gap-2 py-4 rounded-[14px] border border-dashed border-[#C7CDD6] text-[#6C727C] hover:border-[#FFC400] hover:text-ink hover:bg-white transition-all text-sm font-bold"
        >
          <Plus className="w-4 h-4" /> Nova Etapa
        </button>
      </div>
    </div>
  );
}
