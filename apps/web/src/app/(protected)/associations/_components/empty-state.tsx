import Link from 'next/link';
import { Building2, Plus, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <SearchX className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-1">
            <h3 className="text-base font-medium">Aramanıza uyan kayıt yok</h3>
            <p className="text-sm text-muted-foreground">
              Filtreleri sıfırlamayı deneyin.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Building2 className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <h3 className="text-base font-medium">Henüz kayıtlı dernek yok</h3>
          <p className="text-sm text-muted-foreground">
            Sicile yeni bir dernek ekleyerek başlayın.
          </p>
        </div>
        <Button asChild>
          <Link href="/associations/new">
            <Plus className="mr-2 h-4 w-4" />
            Yeni Dernek Ekle
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
