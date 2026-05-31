'use client';

import { useState } from 'react';
import { HandCoins, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  const incomeCategories = (categories ?? []).filter(
    (c) => c.type === 'INCOME',
  );

  function handleAdd() {
    const trimmed = name.trim();
    if (trimmed.length < 1) return;
    createMutation.mutate(
      { name: trimmed, type: 'INCOME' },
      { onSuccess: () => setName('') },
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <header className="mb-4 flex items-center gap-2">
        <HandCoins className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          Bağış Kategorileri (Derneğe Özel)
        </h2>
      </header>

      <p className="mb-4 text-[13px] text-muted-foreground">
        Bu derneğe özel bağış türleri. Telegram&apos;da{' '}
        <span className="font-mono">/bagis</span> ile bağış kaydederken sistem
        türleriyle birlikte listelenir.
      </p>

      {canManage && (
        <div className="mb-4 flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Yeni bağış türü adı (örn. İftar, Kurban)"
            maxLength={100}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <Button
            type="button"
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
        <p className="text-[13px] text-muted-foreground">Yükleniyor…</p>
      ) : incomeCategories.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          Henüz derneğe özel bağış türü yok.
        </p>
      ) : (
        <ul className="divide-y divide-border/70 rounded-md border border-border">
          {incomeCategories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <span className="text-sm font-medium text-foreground">
                {c.name}
              </span>
              {canManage && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`${c.name} kategorisini sil`}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
    </section>
  );
}
