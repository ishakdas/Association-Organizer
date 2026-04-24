'use client';

import { Loader2, Trash2 } from 'lucide-react';
import type { TitleResponse } from '@ticketbot/shared-validation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRemoveTitle } from '../_hooks/use-admin-titles';

interface DeleteTitleDialogProps {
  title: TitleResponse | null;
  onClose: () => void;
}

export function DeleteTitleDialog({ title, onClose }: DeleteTitleDialogProps) {
  const mutation = useRemoveTitle({ onSuccess: onClose });

  const open = title !== null;

  function handleConfirm() {
    if (!title) return;
    mutation.mutate(title.id);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !mutation.isPending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Unvanı arşivle</DialogTitle>
          <DialogDescription>
            {title ? (
              <>
                <span className="font-medium text-foreground">
                  &ldquo;{title.name}&rdquo;
                </span>{' '}
                unvanı pasife alınacak. Bu unvanı hâlihazırda taşıyan üyeler
                etkilenmez; ancak yeni atamalarda listede görünmez. İstediğin
                zaman yeniden aktifleştirebilirsin.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Arşivleniyor…
              </>
            ) : (
              <>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Arşivle
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
