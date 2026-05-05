'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { BookOpen, Pencil, Users } from 'lucide-react';
import type { MeetingNoteResponse } from '@ticketbot/shared-validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMeetings } from '../../_hooks/use-meetings';
import { AddMeetingDialog } from './add-meeting-dialog';
import { AnalyzeMeetingDialog } from './analyze-meeting-dialog';

export function MeetingsSection({
  associationId,
  canManage,
}: {
  associationId: string;
  canManage: boolean;
}) {
  const { data, isLoading, isError, error } = useMeetings(associationId, {
    pageSize: 50,
  });

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[14px] font-semibold tracking-tight">
            Toplantı Notları
            {data && data.data.length > 0 && (
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                ({data.data.length})
              </span>
            )}
          </h2>
        </div>
        {canManage && <AddMeetingDialog associationId={associationId} />}
      </header>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {isError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
          Notlar yüklenemedi: {error.message}
        </p>
      )}

      {data && data.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <BookOpen className="mx-auto h-6 w-6 text-muted-foreground/60" />
          <p className="mt-3 text-[13px] text-muted-foreground">
            Henüz toplantı notu yok.
          </p>
        </div>
      )}

      {data && data.data.length > 0 && (
        <ul className="space-y-2">
          {data.data.map((m) => (
            <MeetingCard
              key={m.id}
              m={m}
              associationId={associationId}
              canManage={canManage}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function MeetingCard({
  m,
  associationId,
  canManage,
}: {
  m: MeetingNoteResponse;
  associationId: string;
  canManage: boolean;
}) {
  const date = useMemo(() => new Date(m.meetingDate), [m.meetingDate]);
  const preview = m.content.slice(0, 220);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <li className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-[14px] font-semibold leading-snug tracking-tight text-foreground">
            {m.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <time dateTime={m.meetingDate}>
              {format(date, 'd MMMM yyyy', { locale: tr })}
            </time>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {m.attendees.length} katılımcı
            </span>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-[11px]"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3 w-3" />
              Düzenle
            </Button>
            <AnalyzeMeetingDialog meeting={m} associationId={associationId} />
            <AddMeetingDialog
              associationId={associationId}
              initialData={m}
              open={editOpen}
              onOpenChange={setEditOpen}
            />
          </div>
        )}
      </div>

      {preview && (
        <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground">
          {preview}
          {m.content.length > preview.length && '…'}
        </p>
      )}

      {m.attendees.length > 0 && (
        <div className="mt-3 flex min-w-0 max-w-full flex-wrap gap-1">
          {m.attendees.slice(0, 6).map((a) => (
            <Badge
              key={a.id}
              variant="outline"
              className="inline-flex max-w-[180px] items-center text-[11px] font-normal"
              title={a.user.fullName}
            >
              <span className="truncate">{a.user.fullName}</span>
            </Badge>
          ))}
          {m.attendees.length > 6 && (
            <Badge
              variant="outline"
              className="shrink-0 cursor-default text-[11px] font-normal"
              title={m.attendees
                .slice(6)
                .map((a) => a.user.fullName)
                .join(', ')}
            >
              +{m.attendees.length - 6}
            </Badge>
          )}
        </div>
      )}
    </li>
  );
}
