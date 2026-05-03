import {
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  Hash,
  Mail,
  MapPin,
  Phone,
  Tag,
  Users,
} from 'lucide-react';
import type { AssociationDto } from '@ticketbot/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function GeneralSection({ a }: { a: AssociationDto }) {
  const founded = new Date(a.foundedAt);
  const updated = new Date(a.updatedAt);
  const initials = a.shortName || a.name.slice(0, 2).toUpperCase();

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <HeroCard
          name={a.name}
          shortName={a.shortName ?? undefined}
          isActive={a.isActive}
          logoUrl={a.logoUrl ?? undefined}
          initials={initials}
          activityArea={a.activityArea}
        />

        <InfoCard
          title="Kimlik"
          eyebrow="01"
          icon={<Building2 className="h-4 w-4" />}
        >
          <Row
            icon={<Hash className="h-3.5 w-3.5" />}
            label="Vergi Numarası"
            value={
              <span className="font-mono text-[13.5px]">
                {a.taxNumber ?? '—'}
              </span>
            }
          />
          <Row
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Kuruluş Tarihi"
            value={founded.toLocaleDateString('tr-TR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          />
          <Row
            icon={<Tag className="h-3.5 w-3.5" />}
            label="Faaliyet Alanı"
            value={a.activityArea}
          />
          <Row
            icon={<Users className="h-3.5 w-3.5" />}
            label="Üye Sayısı"
            value={
              <span className="tabular-nums">
                {a.memberCount.toLocaleString('tr-TR')}
              </span>
            }
          />
        </InfoCard>

        <InfoCard
          title="İletişim"
          eyebrow="02"
          icon={<Phone className="h-4 w-4" />}
        >
          <Row
            icon={<Phone className="h-3.5 w-3.5" />}
            label="Telefon"
            value={
              a.phone ? (
                <a
                  href={`tel:${a.phone}`}
                  className="text-foreground hover:text-primary"
                >
                  {a.phone}
                </a>
              ) : (
                '—'
              )
            }
          />
          <Row
            icon={<Mail className="h-3.5 w-3.5" />}
            label="E-posta"
            value={
              <a
                href={`mailto:${a.email}`}
                className="text-foreground hover:text-primary"
              >
                {a.email}
              </a>
            }
          />
          {a.website && (
            <Row
              icon={<ExternalLink className="h-3.5 w-3.5" />}
              label="Web Sitesi"
              value={
                <a
                  href={a.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-foreground hover:text-primary"
                >
                  {a.website}
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </a>
              }
            />
          )}
          <Row
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Konum"
            value={
              <>
                <span>{a.city}</span>
                <span className="px-1 text-muted-foreground/50">/</span>
                <span>{a.district}</span>
              </>
            }
          />
          <Row
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Adres"
            value={
              <span className="whitespace-pre-wrap">{a.address ?? '—'}</span>
            }
          />
        </InfoCard>

        {a.notes && (
          <InfoCard title="Notlar" eyebrow="03">
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground">
              {a.notes}
            </p>
          </InfoCard>
        )}
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <SidePanel
          title="Durum"
          items={[
            {
              label: 'Kayıt durumu',
              value: (
                <Badge variant={a.isActive ? 'success' : 'outline'}>
                  {a.isActive ? 'Aktif' : 'Pasif'}
                </Badge>
              ),
            },
            {
              label: 'Son güncelleme',
              value: (
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {updated.toLocaleString('tr-TR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              ),
            },
            {
              label: 'Üye sayısı',
              value: (
                <span className="text-[15px] font-semibold tabular-nums text-foreground">
                  {a.memberCount.toLocaleString('tr-TR')}
                </span>
              ),
            },
          ]}
        />
        <SidePanel
          title="Hızlı eylemler"
          items={[
            {
              label: '',
              value: (
                <div className="flex flex-col gap-1.5">
                  <Button variant="outline" size="sm" disabled>
                    Bilgileri düzenle
                  </Button>
                  <Button variant="ghost" size="sm" disabled>
                    Raporu indir
                  </Button>
                </div>
              ),
            },
          ]}
          muted
        />
      </aside>
    </section>
  );
}

function HeroCard({
  name,
  shortName,
  isActive,
  logoUrl,
  initials,
  activityArea,
}: {
  name: string;
  shortName?: string;
  isActive: boolean;
  logoUrl?: string;
  initials: string;
  activityArea: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-6">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] bg-primary"
      />
      <div className="flex items-start gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[15px] font-bold tracking-tight text-muted-foreground">
              {initials}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">Dernek Özeti</span>
            <Badge variant={isActive ? 'success' : 'outline'}>
              {isActive ? 'Aktif' : 'Pasif'}
            </Badge>
          </div>
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-foreground sm:text-[26px]">
            {name}
          </h1>
          <p className="text-[13.5px] text-muted-foreground">
            {shortName && (
              <>
                <span className="font-medium text-foreground">{shortName}</span>
                <span className="px-2 text-muted-foreground/40">·</span>
              </>
            )}
            {activityArea}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  eyebrow,
  icon,
  children,
}: {
  title: string;
  eyebrow: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            {eyebrow}
          </span>
          <Separator orientation="vertical" className="h-3" />
          <h2 className="text-[13.5px] font-semibold tracking-tight text-foreground">
            {title}
          </h2>
        </div>
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 py-2 text-[13.5px] [&+&]:border-t [&+&]:border-border/60">
      <span className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-wide text-muted-foreground">
        {icon && <span className="opacity-60">{icon}</span>}
        {label}
      </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function SidePanel({
  title,
  items,
  muted = false,
}: {
  title: string;
  items: { label: string; value: React.ReactNode }[];
  muted?: boolean;
}) {
  return (
    <aside
      className={`rounded-lg border border-border ${muted ? 'bg-muted/30' : 'bg-card'}`}
    >
      <header className="border-b border-border px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
      </header>
      <div className="space-y-3 px-4 py-3">
        {items.map((item, i) => (
          <div
            key={i}
            className={`${item.label ? 'flex items-center justify-between gap-3' : ''}`}
          >
            {item.label && (
              <span className="text-[12.5px] text-muted-foreground">
                {item.label}
              </span>
            )}
            <div className="min-w-0">{item.value}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
