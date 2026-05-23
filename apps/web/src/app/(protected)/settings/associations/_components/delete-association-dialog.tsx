'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { AdminAssociationResponse } from '@ticketbot/shared-validation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { hardDeleteAssociation } from '@/lib/api/admin';

const CONFIRMATION_TEXT = 'onaylıyorum';

interface DeleteAssociationDialogProps {
  association: AdminAssociationResponse | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteAssociationDialog({
  association,
  onClose,
  onSuccess,
}: DeleteAssociationDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const open = association !== null;
  const canDelete = confirmText.trim().toLowerCase() === CONFIRMATION_TEXT;

  async function handleConfirm() {
    if (!association || !canDelete) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Oturum süresi dolmuş');

      await hardDeleteAssociation(token, association.id);
      onSuccess();
      setConfirmText('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !loading) {
          setConfirmText('');
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Derneği kalıcı olarak sil
          </DialogTitle>
          <div className="space-y-2 pt-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">
                &ldquo;{association?.name}&rdquo;
              </span>{' '}
              derneğini kalıcı olarak silmek üzeresiniz.
            </p>
            <p className="text-destructive font-medium">
              Bu işlem geri alınamaz. Derneğe ait tüm veriler (üyeler, görevler,
              toplantılar, etkinlikler, finansal kayıtlar) ve yalnızca bu derneğe
              ait kullanıcılar hem veritabanından hem de Supabase&apos;den tamamen
              silinecektir.
            </p>
            <div className="pt-2">
              <Label htmlFor="confirm-delete" className="text-sm">
                Devam etmek için{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                  {CONFIRMATION_TEXT}
                </code>{' '}
                yazın:
              </Label>
              <Input
                id="confirm-delete"
                className="mt-2"
                placeholder={CONFIRMATION_TEXT}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setConfirmText('');
              onClose();
            }}
            disabled={loading}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canDelete || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Siliniyor…
              </>
            ) : (
              <>Kalıcı Olarak Sil</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
