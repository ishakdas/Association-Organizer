'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Download,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react';
import { AiComingSoon } from './ai-coming-soon';
import { UserRole } from '@ticketbot/shared-types';
import type {
  EventAssignmentInput,
  EventListItem,
  EventResponse,
  EventRoleResponse,
  EventTypeValue,
  RecurrenceTypeValue,
  MemberResponse,
} from '@ticketbot/shared-validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { toast } from 'sonner';
import {
  addEventAssignment,
  createEvent,
  deleteEvent,
  downloadEventPdf,
  getEvent,
  listEventRoles,
  listEvents,
  removeEventAssignment,
  updateEvent,
} from '@/lib/api/events';
import { listMembers } from '@/lib/api/members';

interface MembershipSummary {
  associationId: string;
  associationName: string;
  role: UserRole;
}

interface Props {
  token: string;
  memberships: MembershipSummary[];
}

const EVENT_TYPE_LABELS: Record<EventTypeValue, string> = {
  CONFERENCE: 'Konferans',
  TALK: 'Sohbet',
  SEMINAR: 'Seminer',
  IFTAR: 'İftar',
  KANDIL: 'Kandil',
  MEETING: 'Toplantı',
  CUSTOM: 'Diğer',
};

const RECURRENCE_LABELS: Record<RecurrenceTypeValue, string> = {
  NONE: 'Tek seferlik',
  DAILY: 'Günlük',
  WEEKLY: 'Haftalık',
  MONTHLY: 'Aylık',
};

const TR_DATE = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});

function canManage(role: UserRole) {
  return (
    role === UserRole.ASSOCIATION_MANAGER ||
    role === UserRole.ASSOCIATION_SECRETARY ||
    role === UserRole.SYSTEM_ADMIN
  );
}

export function EventsOverview({ token, memberships }: Props) {
  const [activeId, setActiveId] = useState(memberships[0]?.associationId ?? '');
  const active = memberships.find((m) => m.associationId === activeId);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailEventId, setDetailEventId] = useState<string | null>(null);

  const refresh = useMemo(
    () => async () => {
      if (!activeId) return;
      setLoading(true);
      try {
        const res = await listEvents(token, activeId, { pageSize: 100 });
        setEvents(res.data);
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [token, activeId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!active) return null;
  const writable = canManage(active.role);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Etkinlikler</h1>
          <p className="text-sm text-muted-foreground">
            Konferans, sohbet, iftar, kandil ve diğer programlar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {memberships.length > 1 && (
            <Select value={activeId} onValueChange={setActiveId}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {memberships.map((m) => (
                  <SelectItem key={m.associationId} value={m.associationId}>
                    {m.associationName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {writable && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Yeni Etkinlik
            </Button>
          )}
        </div>
      </header>

      <AiComingSoon />

      {loading && events.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Yükleniyor…
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">Henüz etkinlik yok</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {writable
                ? 'Yeni bir etkinlik oluşturarak başlayın.'
                : 'Yöneticiler bir etkinlik oluşturduğunda burada görünecek.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => (
            <EventCard key={e.id} event={e} onClick={() => setDetailEventId(e.id)} />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateEventDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          token={token}
          associationId={activeId}
          onCreated={() => {
            setCreateOpen(false);
            void refresh();
          }}
        />
      )}

      {detailEventId && (
        <EventDetailDialog
          token={token}
          associationId={activeId}
          eventId={detailEventId}
          writable={writable}
          onClose={() => setDetailEventId(null)}
          onChanged={() => {
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function EventCard({ event, onClick }: { event: EventListItem; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight">{event.title}</CardTitle>
            <Badge variant="secondary">{EVENT_TYPE_LABELS[event.type]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {TR_DATE.format(new Date(event.startsAt))}
          </div>
          {event.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {event.location}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {event.assignmentCount} sorumlu
          </div>
          {event.recurrenceType !== 'NONE' && (
            <div className="flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5" />
              {RECURRENCE_LABELS[event.recurrenceType]}
            </div>
          )}
        </CardContent>
      </Card>
    </button>
  );
}

function CreateEventDialog({
  open,
  onOpenChange,
  token,
  associationId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string;
  associationId: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<EventTypeValue>('CUSTOM');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState<Date | undefined>(undefined);
  const [reminderHours, setReminderHours] = useState('24');
  const [recurrence, setRecurrence] = useState<RecurrenceTypeValue>('NONE');
  const [showDetails, setShowDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setType('CUSTOM');
    setLocation('');
    setStartsAt(undefined);
    setReminderHours('24');
    setRecurrence('NONE');
    setShowDetails(false);
  }, [open]);

  async function handleSubmit() {
    if (!title.trim()) return toast.error('Başlık gerekli');
    if (!startsAt) return toast.error('Başlangıç tarihi gerekli');
    if (startsAt.getTime() <= Date.now()) return toast.error('İleri bir tarih seçin');

    const reminderMs = Number(reminderHours) * 60 * 60 * 1000;
    const calculatedNotifyAt = new Date(Math.max(Date.now(), startsAt.getTime() - reminderMs));

    setSubmitting(true);
    try {
      await createEvent(token, associationId, {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        location: location.trim() || undefined,
        startsAt: startsAt.toISOString(),
        notifyAt: calculatedNotifyAt.toISOString(),
        recurrenceType: recurrence,
        recurrenceInterval: 1,
        assignments: [],
      });
      toast.success('Etkinlik oluşturuldu');
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Yeni Etkinlik</DialogTitle>
          <DialogDescription>
            Temel bilgileri girin. Sorumluları ve gerçekleşen harcamaları daha sonra
            ekleyebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">Etkinlik adı</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn. Gençlik Buluşması"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tarih ve saat</Label>
            <DateTimePicker
              value={startsAt}
              onChange={setStartsAt}
              placeholder="Etkinlik tarihini seçin"
              defaultHour={19}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">
              Yer <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
            </Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Dernek salonu"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">
              Kısa açıklama{' '}
              <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
            </Label>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Katılımcıların bilmesi gereken kısa bir not…"
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-primary/40 bg-primary/5">
            <button
              type="button"
              onClick={() => setShowDetails((value) => !value)}
              className="group flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-primary/10"
              aria-expanded={showDetails}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
                  <SlidersHorizontal className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Diğer ayrıntılar</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    Tür, tekrar ve hatırlatma ayarları
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="secondary"
                  className="hidden bg-background/80 font-normal text-muted-foreground sm:inline-flex"
                >
                  İsteğe bağlı
                </Badge>
                <ChevronDown
                  className={`h-4 w-4 text-foreground transition-transform ${showDetails ? 'rotate-180' : ''}`}
                />
              </span>
            </button>
            {showDetails && (
              <div className="grid gap-4 border-t border-primary/25 bg-card p-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Etkinlik türü</Label>
                  <Select value={type} onValueChange={(v) => setType(v as EventTypeValue)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EVENT_TYPE_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tekrar</Label>
                  <Select
                    value={recurrence}
                    onValueChange={(v) => setRecurrence(v as RecurrenceTypeValue)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RECURRENCE_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Hatırlatma</Label>
                  <Select value={reminderHours} onValueChange={setReminderHours}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 saat önce</SelectItem>
                      <SelectItem value="24">1 gün önce</SelectItem>
                      <SelectItem value="72">3 gün önce</SelectItem>
                      <SelectItem value="168">1 hafta önce</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Varsayılan olarak etkinlikten 1 gün önce hatırlatılır.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg bg-muted/50 px-3.5 py-3 text-xs leading-5 text-muted-foreground">
            Etkinliği oluşturduktan sonra sorumlu atayabilir ve gerçekleşen harcamaları
            kaydedebilirsiniz.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Oluşturuluyor…' : 'Etkinliği Oluştur'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventDetailDialog({
  token,
  associationId,
  eventId,
  writable,
  onClose,
  onChanged,
}: {
  token: string;
  associationId: string;
  eventId: string;
  writable: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [event, setEvent] = useState<EventResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [roles, setRoles] = useState<EventRoleResponse[]>([]);
  const [adding, setAdding] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [editingExpense, setEditingExpense] = useState(false);
  const [editExpenseAmount, setEditExpenseAmount] = useState('');
  const [editExpenseNote, setEditExpenseNote] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const e = await getEvent(token, associationId, eventId);
      setEvent(e);
      setEditExpenseAmount(e.expenseAmount ? (e.expenseAmount / 100).toFixed(2) : '');
      setEditExpenseNote(e.expenseNote ?? '');
      setEditingExpense(false);
    } catch (err) {
      toast.error((err as Error).message);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    if (writable) {
      Promise.all([
        listMembers(token, associationId, { isActive: true }),
        listEventRoles(token, associationId),
      ])
        .then(([m, r]) => {
          setMembers(m);
          setRoles(r);
        })
        .catch(() => undefined);
    }
  }, [eventId]);

  async function handleDelete() {
    if (!confirm('Bu etkinliği silmek istediğine emin misin?')) return;
    try {
      await deleteEvent(token, associationId, eventId);
      toast.success('Etkinlik silindi');
      onChanged();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handlePdf() {
    setPdfBusy(true);
    try {
      const blob = await downloadEventPdf(token, associationId, eventId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `etkinlik-${eventId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleRemoveAssignment(assignmentId: string) {
    try {
      await removeEventAssignment(token, associationId, eventId, assignmentId);
      await load();
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleSaveExpense() {
    setSavingExpense(true);
    try {
      await updateEvent(token, associationId, eventId, {
        expenseAmount: editExpenseAmount ? Math.round(parseFloat(editExpenseAmount) * 100) : null,
        expenseNote: editExpenseNote.trim() || null,
      });
      toast.success('Harcama güncellendi');
      setEditingExpense(false);
      await load();
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingExpense(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogTitle className="sr-only">Etkinlik Detayı</DialogTitle>
        {loading || !event ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-2">
                <DialogTitle className="text-xl">{event.title}</DialogTitle>
                <Badge variant="secondary">{EVENT_TYPE_LABELS[event.type]}</Badge>
              </div>
              {event.description && (
                <DialogDescription className="whitespace-pre-wrap pt-1">
                  {event.description}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="grid grid-cols-1 gap-2 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-2">
              <Meta
                icon={CalendarDays}
                label="Başlangıç"
                value={TR_DATE.format(new Date(event.startsAt))}
              />
              <Meta
                icon={CalendarDays}
                label="Bildirim"
                value={TR_DATE.format(new Date(event.notifyAt))}
              />
              {event.location && <Meta icon={MapPin} label="Yer" value={event.location} />}
              <Meta icon={Repeat} label="Tekrar" value={RECURRENCE_LABELS[event.recurrenceType]} />
              <Meta
                icon={BarChart3}
                label="Gerçekleşen harcama"
                value={
                  event.expenseAmount != null && event.expenseAmount > 0
                    ? `${(event.expenseAmount / 100).toFixed(2)} TL`
                    : '—'
                }
              />
            </div>
            {event.expenseNote && !editingExpense && (
              <p className="text-xs text-muted-foreground">{event.expenseNote}</p>
            )}

            {writable && !editingExpense && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingExpense(true)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Gerçekleşen Harcama Ekle
                </Button>
              </div>
            )}

            {editingExpense && (
              <div className="space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tutar (TL)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editExpenseAmount}
                      onChange={(e) => setEditExpenseAmount(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Not</Label>
                    <Input
                      value={editExpenseNote}
                      onChange={(e) => setEditExpenseNote(e.target.value)}
                      placeholder="Harcama açıklaması"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingExpense(false);
                      setEditExpenseAmount(
                        event.expenseAmount ? (event.expenseAmount / 100).toFixed(2) : '',
                      );
                      setEditExpenseNote(event.expenseNote ?? '');
                    }}
                  >
                    İptal
                  </Button>
                  <Button size="sm" onClick={handleSaveExpense} disabled={savingExpense}>
                    {savingExpense ? 'Kaydediliyor…' : 'Kaydet'}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Sorumluluklar ({event.assignments.length})
                </h3>
                {writable && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Sorumlu ekle
                  </Button>
                )}
              </div>

              {event.assignments.length === 0 ? (
                <p className="rounded-md border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
                  Henüz sorumlu atanmadı.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {event.assignments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {a.roleDefinition?.name ?? a.customRole ?? '—'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.member.fullName}
                          {a.member.phone ? ` · ${a.member.phone}` : ''}
                        </div>
                        {a.notes && (
                          <div className="text-xs italic text-muted-foreground">{a.notes}</div>
                        )}
                      </div>
                      {writable && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignment(a.id)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {adding && writable && (
                <AddAssignmentRow
                  members={members}
                  roles={roles}
                  onCancel={() => setAdding(false)}
                  onAdd={async (input) => {
                    try {
                      await addEventAssignment(token, associationId, eventId, input);
                      setAdding(false);
                      await load();
                      onChanged();
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                />
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={handlePdf} disabled={pdfBusy}>
                <Download className="h-4 w-4" />
                {pdfBusy ? 'PDF hazırlanıyor…' : 'PDF indir'}
              </Button>
              {writable && (
                <Button variant="ghost" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                  Sil
                </Button>
              )}
              <Button variant="default" onClick={onClose}>
                Kapat
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}

function AddAssignmentRow({
  members,
  roles,
  onCancel,
  onAdd,
}: {
  members: MemberResponse[];
  roles: EventRoleResponse[];
  onCancel: () => void;
  onAdd: (input: EventAssignmentInput) => Promise<void>;
}) {
  const [membershipId, setMembershipId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [customRole, setCustomRole] = useState('');

  const submit = async () => {
    if (!membershipId) return toast.error('Üye seçin');
    if (!roleId && !customRole.trim()) return toast.error('Rol seçin');
    await onAdd({
      membershipId,
      roleDefinitionId: roleId || undefined,
      customRole: !roleId && customRole.trim() ? customRole.trim() : undefined,
    });
  };

  return (
    <div className="space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select value={membershipId} onValueChange={setMembershipId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Üye" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.user.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {roles.length > 0 ? (
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            placeholder="Rol (örn. Ses Sistemi)"
            value={customRole}
            onChange={(e) => setCustomRole(e.target.value)}
          />
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          İptal
        </Button>
        <Button size="sm" onClick={submit}>
          <Plus className="h-3.5 w-3.5" />
          Ekle
        </Button>
      </div>
    </div>
  );
}
