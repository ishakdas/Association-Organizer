'use client';

import { useEffect, useMemo, useState } from 'react';
import { Globe, MapPin, Calendar, Clock, ExternalLink } from 'lucide-react';
import type { ExternalEventItem } from '@ticketbot/shared-validation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listGebzeExternalEvents } from '@/lib/api/events';
import { toast } from 'sonner';

interface Props {
  token: string;
  associationId: string;
  district: string | null;
}

type DateFilter = 'today' | 'week' | 'month' | 'all';

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  today: 'Bugün',
  week: 'Bu Hafta',
  month: 'Bu Ay',
  all: 'Tümü',
};

export function GebzeEventsCard({ token, associationId, district }: Props) {
  const [events, setEvents] = useState<ExternalEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<DateFilter>('all');

  const isGebze = district?.toLowerCase() === 'gebze';

  useEffect(() => {
    if (!isGebze) return;
    setLoading(true);
    listGebzeExternalEvents(token, associationId)
      .then((res) => setEvents(res.data))
      .catch((err) => toast.error(err.message || 'Etkinlikler yüklenemedi'))
      .finally(() => setLoading(false));
  }, [token, associationId, isGebze]);

  const filtered = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return events.filter((e) => {
      const d = new Date(e.eventDate);
      d.setHours(0, 0, 0, 0);

      switch (filter) {
        case 'today':
          return d.getTime() === now.getTime();
        case 'week': {
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          return d >= startOfWeek && d <= endOfWeek;
        }
        case 'month': {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        default:
          return true;
      }
    });
  }, [events, filter]);

  if (!isGebze) return null;

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Gebze Belediyesi Etkinlikleri</CardTitle>
          </div>
          <span className="text-[11px] text-muted-foreground">Yaklaşan programlar</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              className="h-7 text-[11px]"
              onClick={() => setFilter(f)}
            >
              {DATE_FILTER_LABELS[f]}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Yükleniyor…</div>
        ) : filtered.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Bu filtreye uygun etkinlik bulunamadı.
          </div>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {filtered.map((e) => (
              <div
                key={e.id}
                className="flex gap-3 rounded-md border border-border/60 bg-background/60 p-2.5 transition-colors hover:bg-background"
              >
                {e.imageUrl ? (
                  <img
                    src={e.imageUrl}
                    alt={e.title}
                    className="h-16 w-16 flex-shrink-0 rounded-md object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md bg-muted">
                    <Calendar className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="truncate text-[13px] font-medium leading-tight">{e.title}</h4>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {e.category}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {e.location}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(e.eventDate).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                      })}
                    </span>
                    {e.eventTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {e.eventTime}
                      </span>
                    )}
                    <a
                      href={e.detailUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      Detaylar
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
