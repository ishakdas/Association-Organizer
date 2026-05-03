'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Loader2,
  Search,
  Send,
} from 'lucide-react';
import type { TaskResponse } from '@ticketbot/shared-validation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useMembers } from '../../_hooks/use-members';
import { useResolveTaskDispute } from '../../_hooks/use-tasks';

export function ResolveDisputeDialog({
  associationId,
  task,
  currentAssigneeName,
  open,
  onOpenChange,
}: {
  associationId: string;
  task: TaskResponse;
  currentAssigneeName: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [newAssigneeId, setNewAssigneeId] = useState<string>('');
  const mutation = useResolveTaskDispute(associationId, {
    onSuccess: () => {
      setNewAssigneeId('');
      onOpenChange(false);
    },
  });

  function handleSubmit() {
    if (!newAssigneeId) return;
    mutation.mutate({
      taskId: task.id,
      input: { assignedToUserId: newAssigneeId },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Görev itirazını çöz
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">
              {currentAssigneeName ?? 'Atanan kişi'}
            </span>{' '}
            bu görevin kendisine ait olmadığını söyledi. Görevi yeniden hangi
            üyeye atamak istediğinizi seçin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-[12.5px]">
            <p className="font-medium text-foreground">{task.title}</p>
            {task.description && (
              <p className="mt-1 line-clamp-3 text-muted-foreground">
                {task.description}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">
              Yeni atanan kişi *
            </label>
            <ResolutionAssigneePicker
              associationId={associationId}
              excludeUserId={task.assignedToUserId}
              value={newAssigneeId}
              onChange={setNewAssigneeId}
            />
            <p className="text-[11px] text-muted-foreground">
              Listede tüm dernek üyeleri görünür. Telegram bağlı olmayan üye
              seçilirse görev kaydedilir, sadece bildirim gitmez.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Vazgeç
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!newAssigneeId || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Atanıyor…
              </>
            ) : (
              'Yeniden ata'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResolutionAssigneePicker({
  associationId,
  excludeUserId,
  value,
  onChange,
}: {
  associationId: string;
  excludeUserId: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: members, isLoading } = useMembers(associationId);

  const filtered = useMemo(() => {
    const all = members ?? [];
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return all
      .filter((m) => m.user.id !== excludeUserId)
      .filter((m) => {
        if (!q) return true;
        return (
          m.user.fullName.toLocaleLowerCase('tr-TR').includes(q) ||
          (m.user.email ?? '').toLocaleLowerCase('tr-TR').includes(q)
        );
      });
  }, [members, query, excludeUserId]);

  const selected = members?.find((m) => m.user.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
          )}
        >
          {selected ? selected.user.fullName : 'Üye seçin…'}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="border-b border-border px-2.5 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ada göre ara…"
              className="h-8 w-full rounded-sm border-0 bg-transparent pl-7 text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div role="listbox" className="max-h-[260px] overflow-y-auto py-1">
          {isLoading && (
            <div className="px-3 py-2 text-[12px] text-muted-foreground">
              Yükleniyor…
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="px-3 py-3 text-center text-[12px] text-muted-foreground">
              Kayıt yok
            </div>
          )}
          {filtered.map((m) => {
            const active = m.user.id === value;
            const hasTelegram = !!m.user.telegramAccount;
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(m.user.id);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-accent/60',
                  active && 'bg-accent',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-foreground">
                    {m.user.fullName}
                  </span>
                  {m.user.email && (
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      {m.user.email}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {hasTelegram ? (
                    <span
                      title="Telegram bağlı — bildirim alır"
                      className="inline-flex items-center gap-1 text-[10.5px] text-emerald-700 dark:text-emerald-400"
                    >
                      <Send className="h-3 w-3" />
                    </span>
                  ) : (
                    <span
                      title="Telegram bağlı değil — bildirim almaz"
                      className="inline-flex items-center gap-1 text-[10.5px] text-amber-700 dark:text-amber-400"
                    >
                      <AlertTriangle className="h-3 w-3" />
                    </span>
                  )}
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
