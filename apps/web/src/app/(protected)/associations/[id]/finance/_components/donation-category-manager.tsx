'use client';

import { useState } from 'react';
import { HandCoins, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  useFinanceCategories,
  useCreateCategory,
  useDeleteCategory,
} from '../../../_hooks/use-finance';

// Derneğe özel bağış (INCOME) kategorileri. Sistem genelindeki ortak türler
// (Zekat, Genel…) admin tarafından yönetilir; burada her dernek yalnızca
// kendi ek türlerini ekler. Bu kategoriler bot /bagis tür seçicide global
// katalogla birlikte görünür.
export function DonationCategoryManager({
  associationId,
  canManage,
}: {
  associationId: string;
  canManage: boolean;
}) {
  const [name, setName] = useState('');
  const { data: categories, isLoading } = useFinanceCategories(associationId);
  const createMutation = useCreateCategory(associationId);
  const deleteMutation = useDeleteCategory(associationId);

  const incomeCategories = (categories ?? []).filter((c) => c.type === 'INCOME');

  function handleAdd() {
    const trimmed = name.trim();
    if (trimmed.length < 1) return;
    createMutation.mutate({ name: trimmed, type: 'INCOME' }, { onSuccess: () => setName('') });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
          <HandCoins className="mr-1 h-3.5 w-3.5" />
          Bağış kategorileri
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <HandCoins className="h-4 w-4 text-primary" />
            Bağış kategorileri
          </DialogTitle>
          <DialogDescription className="text-xs leading-5">
            Derneğe özel bağış türleri Telegram&apos;daki <span className="font-mono">/bagis</span>{' '}
            akışında sistem türleriyle birlikte gösterilir.
          </DialogDescription>
        </DialogHeader>

        {canManage && (
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. İftar, Kurban"
              maxLength={100}
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-9"
              onClick={handleAdd}
              disabled={createMutation.isPending || name.trim().length < 1}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Ekle
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : incomeCategories.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
            Henüz derneğe özel bağış kategorisi yok.
          </div>
        ) : (
          <ul className="max-h-64 divide-y divide-border/70 overflow-y-auto rounded-md border">
            {incomeCategories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm font-medium text-foreground">{c.name}</span>
                {canManage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`${c.name} kategorisini sil`}
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `"${c.name}" bağış türü silinsin mi? (Bu türe ait işlem varsa silinemez.)`,
                        )
                      ) {
                        deleteMutation.mutate(c.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
