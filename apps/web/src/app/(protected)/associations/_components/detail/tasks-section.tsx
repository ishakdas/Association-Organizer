'use client';

import { ClipboardList } from 'lucide-react';

export function TasksSection({
  associationId: _associationId,
  canManage: _canManage,
}: {
  associationId: string;
  canManage: boolean;
}) {
  return (
    <section className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
      <ClipboardList className="mx-auto h-6 w-6 text-muted-foreground/60" />
      <h2 className="mt-3 text-[14px] font-semibold tracking-tight">Görevler</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-muted-foreground">
        Görev yönetimi yakında bu sekmede çalışır. Atama, bitiş tarihi,
        hatırlatma ve durum filtreleri ileriki sürümde aktif olur.
      </p>
    </section>
  );
}
