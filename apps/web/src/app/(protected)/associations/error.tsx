'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AssociationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AssociationsError]', error);
  }, [error]);

  return (
    <div className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-6 py-16 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-destructive/30 bg-background text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <span className="eyebrow mt-5 block text-destructive/80">Hata</span>
      <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-foreground">
        Bir şeyler ters gitti
      </h3>
      <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
        {error.message || 'Dernekler yüklenirken bir hata oluştu.'}
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">
          #{error.digest}
        </p>
      )}
      <div className="mt-5 flex justify-center">
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5" />
          Tekrar dene
        </Button>
      </div>
    </div>
  );
}
