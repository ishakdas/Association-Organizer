'use client';

import { useState } from 'react';
import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react';
import type { TitleResponse } from '@ticketbot/shared-validation';
import { updateMemberTitleSchema } from '@ticketbot/shared-validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useUpdateTitle } from '../_hooks/use-admin-titles';

interface TitleRowProps {
  title: TitleResponse;
  onRequestDelete: (title: TitleResponse) => void;
}

export function TitleRow({ title, onRequestDelete }: TitleRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(title.name);
  const [sortOrder, setSortOrder] = useState(String(title.sortOrder));
  const [localError, setLocalError] = useState<string | null>(null);

  const updateMutation = useUpdateTitle({
    onSuccess: () => {
      setEditing(false);
      setLocalError(null);
    },
  });

  function startEdit() {
    setName(title.name);
    setSortOrder(String(title.sortOrder));
    setLocalError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setLocalError(null);
  }

  function saveEdit() {
    const nameTrimmed = name.trim();
    const parsed = updateMemberTitleSchema.safeParse({
      name: nameTrimmed,
      sortOrder,
    });
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? 'Geçersiz değer');
      return;
    }
    if (
      parsed.data.name === title.name &&
      parsed.data.sortOrder === title.sortOrder
    ) {
      setEditing(false);
      setLocalError(null);
      return;
    }
    updateMutation.mutate({ id: title.id, input: parsed.data });
  }

  function handleToggleActive(next: boolean) {
    updateMutation.mutate({
      id: title.id,
      input: { isActive: next },
    });
  }

  const isSaving = updateMutation.isPending;

  return (
    <TableRow
      className={cn(!title.isActive && 'text-muted-foreground')}
      data-state={editing ? 'selected' : undefined}
    >
      <TableCell>
        {editing ? (
          <div className="space-y-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Unvan adı"
              autoFocus
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
            />
            {localError && (
              <p className="text-[11.5px] text-destructive">{localError}</p>
            )}
          </div>
        ) : (
          <span className="font-medium text-foreground">{title.name}</span>
        )}
      </TableCell>
      <TableCell className="font-mono text-[12px] text-muted-foreground">
        {title.slug}
      </TableCell>
      <TableCell className="w-28 tabular-nums">
        {editing ? (
          <Input
            type="number"
            min={0}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            aria-label="Sıralama"
            className="h-9 w-20"
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
          />
        ) : (
          title.sortOrder
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={title.isActive}
            disabled={isSaving || editing}
            onCheckedChange={handleToggleActive}
            aria-label={title.isActive ? 'Pasif yap' : 'Aktif yap'}
          />
          <span
            className={cn(
              'text-[12px] font-medium',
              title.isActive ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {title.isActive ? 'Aktif' : 'Pasif'}
          </span>
        </div>
      </TableCell>
      <TableCell className="w-40 text-right">
        {editing ? (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={cancelEdit}
              disabled={isSaving}
              aria-label="İptal"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveEdit}
              disabled={isSaving}
              aria-label="Kaydet"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={startEdit}
              aria-label="Düzenle"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onRequestDelete(title)}
              disabled={!title.isActive}
              aria-label="Arşivle"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
