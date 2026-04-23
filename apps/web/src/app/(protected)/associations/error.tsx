'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div className="space-y-1">
          <h3 className="text-base font-medium">Bir şeyler ters gitti</h3>
          <p className="text-sm text-muted-foreground">
            {error.message || 'Dernekler yüklenirken hata oluştu.'}
          </p>
        </div>
        <Button onClick={reset}>Tekrar dene</Button>
      </CardContent>
    </Card>
  );
}
