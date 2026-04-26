'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDeleteAssociation } from '../_hooks/use-associations';

export function DeleteAssociationDialog({
  associationId,
  associationName,
}: {
  associationId: string;
  associationName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useDeleteAssociation({
    onSuccess: (result) => {
      setOpen(false);
      toast.success(
        `"${associationName}" silindi — ${result.membershipsDeleted} üyelik` +
          (result.telegramAccountsUnlinked > 0
            ? `, ${result.telegramAccountsUnlinked} Telegram bağlantısı kaldırıldı`
            : '') +
          '.',
      );
      // router.refresh() forces a new server render so canCreate is recalculated
      // correctly for the empty-state page.
      router.refresh();
      router.push('/associations');
    },
  });

  const confirmed = confirmInput.trim() === associationName.trim();

  function handleOpenChange(next: boolean) {
    if (mutation.isPending) return;
    setOpen(next);
    if (!next) setConfirmInput('');
  }

  function handleDelete() {
    if (!confirmed || mutation.isPending) return;
    mutation.mutate(associationId);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-destructive/40 text-destructive hover:border-destructive hover:bg-destructive/5 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Derneği Sil
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Derneği Kalıcı Olarak Sil
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] leading-relaxed text-destructive">
              <p className="font-semibold">Bu işlem geri alınamaz. Silindiğinde:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-[12.5px]">
                <li>Tüm üyelik kayıtları kalıcı olarak silinir</li>
                <li>Başka dernekte üyeliği olmayan üyelerin Telegram bağlantıları koparılır</li>
                <li>Derneğe ait görevler ve toplantı notları arşivlenir</li>
                <li>Üye hesapları ve diğer derneklerdeki verileri değiştirilmez</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-name" className="text-[13px]">
                Onaylamak için dernek adını girin:{' '}
                <span className="font-semibold text-foreground">
                  {associationName}
                </span>
              </Label>
              <Input
                id="confirm-name"
                ref={inputRef}
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && confirmed) handleDelete();
                }}
                placeholder={associationName}
                autoComplete="off"
                disabled={mutation.isPending}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
                disabled={mutation.isPending}
              >
                İptal
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={!confirmed || mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Siliniyor…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Kalıcı Olarak Sil
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
