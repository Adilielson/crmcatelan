/** @jsxImportSource react */
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KanbanColumn, useCreateKanbanColumn, useUpdateKanbanColumn } from '@/hooks/use-kanban-columns';

const PRESET_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#22c55e', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#6366f1', '#64748b',
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: KanbanColumn | null;
  nextPosition?: number;
}

export function KanbanColumnDialog({ open, onOpenChange, editing, nextPosition = 100 }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const create = useCreateKanbanColumn();
  const update = useUpdateKanbanColumn();

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setColor(editing.color);
    } else {
      setName('');
      setColor(PRESET_COLORS[0]);
    }
  }, [editing, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editing) {
      await update.mutateAsync({ id: editing.id, updates: { name: name.trim(), color } });
    } else {
      await create.mutateAsync({ name: name.trim(), color, position: nextPosition });
    }
    onOpenChange(false);
  };

  const isSystem = editing?.is_system ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Coluna' : 'Nova Coluna do Kanban'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Nome da coluna</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Aguardando Exame"
              disabled={isSystem}
              maxLength={40}
            />
            {isSystem && (
              <p className="text-[11px] text-muted-foreground">
                Colunas do sistema têm nome fixo, mas você pode alterar a cor.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || create.isPending || update.isPending}>
            {editing ? 'Salvar' : 'Criar coluna'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
