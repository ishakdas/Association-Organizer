import { FolderSearch, Inbox, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmptyState({
  hasFilters,
  onReset,
  canCreate,
}: {
  hasFilters: boolean;
  onReset?: () => void;
  canCreate: boolean;
}) {
  if (hasFilters) {
    return (
      <Shell
        icon={<FolderSearch className="h-5 w-5" />}
        eyebrow="Sonuç bulunamadı"
        title="Aramanıza uyan dernek yok"
        body="Farklı anahtar kelime deneyin veya filtreleri sıfırlayın."
        action={
          onReset ? (
            <Button variant="outline" size="sm" onClick={onReset}>
              <RotateCcw className="h-3.5 w-3.5" />
              Filtreleri sıfırla
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <Shell
      icon={<Inbox className="h-5 w-5" />}
      eyebrow="Başlangıç"
      title="Henüz kayıtlı dernek yok"
      body="Sicile yeni bir dernek eklemek için sistem yöneticisine başvurun."
      action={null}
    />
  );
}

function Shell({
  icon,
  eyebrow,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
        {icon}
      </div>
      <span className="eyebrow mt-5 block">{eyebrow}</span>
      <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted-foreground">
        {body}
      </p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
