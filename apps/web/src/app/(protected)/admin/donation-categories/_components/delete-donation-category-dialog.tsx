'use client';

import { Loader2, Trash2 } from 'lucide-react';
import type { DonationCategoryResponse } from '@ticketbot/shared-validation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRemoveDonationCategory } from '../_hooks/use-admin-donation-categories';

interface DeleteDonationCategoryDialogProps {
  category: DonationCategoryResponse | null;
  onClose: () => void;
}

export function DeleteDonationCategoryDialog({
  category,
  onClose,
}: DeleteDonationCategoryDialogProps) {
  const mutation = useRemoveDonationCategory({ onSuccess: onClose });

  const open = category !== null;

  function handleConfirm() {
    if (!category) return;
    mutation.mutate(category.id);
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
          <DialogTitle>Bağış türünü arşivle</DialogTitle>
          <DialogDescription>
            {category ? (
              <>
                <span className="font-medium text-foreground">
                  &ldquo;{category.name}&rdquo;
                </span>{' '}
                bağış türü pasife alınacak. Bu türle daha önce kaydedilmiş
                bağışlar etkilenmez; ancak yeni bağış kaydında listede görünmez.
                İstediğin zaman yeniden aktifleştirebilirsin.
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
