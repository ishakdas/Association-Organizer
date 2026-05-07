'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Download,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { SmartSuggestionHub } from './smart-suggestion-hub';
import { IslamicInfoSuggestionsDialog } from './islamic-info-suggestions-dialog';
import { GebzeEventsCard } from './gebze-events-card';
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  district: string | null;
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
  const [createPrefill, setCreatePrefill] = useState<{ title?: string; description?: string; type?: EventTypeValue } | undefined>(undefined);
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
            <>
              <SmartSuggestionHub
                token={token}
                associationId={activeId}
                onCreateEvent={(prefill) => {
                  setCreatePrefill(prefill as { title?: string; description?: string; type?: EventTypeValue });
                  setCreateOpen(true);
                }}
              />
              <Button onClick={() => { setCreatePrefill(undefined); setCreateOpen(true); }}>
                <Plus className="h-4 w-4" />
                Yeni Etkinlik
              </Button>
            </>
          )}
        </div>
      </header>

      <GebzeEventsCard
        token={token}
        associationId={activeId}
        district={active.district}
      />

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
            <EventCard
              key={e.id}
              event={e}
              onClick={() => setDetailEventId(e.id)}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateEventDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          token={token}
          associationId={activeId}
          prefill={createPrefill}
          onCreated={() => {
            setCreateOpen(false);
            setCreatePrefill(undefined);
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

function EventCard({
  event,
  onClick,
}: {
  event: EventListItem;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight">
              {event.title}
            </CardTitle>
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

interface AssignmentDraft {
  membershipId: string;
  roleDefinitionId: string;
  customRole: string;
  notes: string;
}

function CreateEventDialog({
  open,
  onOpenChange,
  token,
  associationId,
  onCreated,
  prefill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string;
  associationId: string;
  onCreated: () => void;
  prefill?: { title?: string; description?: string; type?: EventTypeValue };
}) {
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [description, setDescription] = useState(prefill?.description ?? '');
  const [type, setType] = useState<EventTypeValue>(prefill?.type ?? 'TALK');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState<Date | undefined>(undefined);
  const [notifyAt, setNotifyAt] = useState<Date | undefined>(undefined);
  const [recurrence, setRecurrence] = useState<RecurrenceTypeValue>('NONE');
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([]);
  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [roles, setRoles] = useState<EventRoleResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(prefill?.title ?? '');
    setDescription(prefill?.description ?? '');
    setType(prefill?.type ?? 'TALK');
    Promise.all([
      listMembers(token, associationId, { isActive: true }),
      listEventRoles(token, associationId),
    ])
      .then(([m, r]) => {
        setMembers(m);
        setRoles(r);
      })
      .catch((err) => toast.error((err as Error).message));
  }, [open, token, associationId, prefill]);

  async function handleSubmit() {
    if (!title.trim()) return toast.error('Başlık gerekli');
    if (!startsAt) return toast.error('Başlangıç tarihi gerekli');
    if (!notifyAt) return toast.error('Bildirim zamanı gerekli');
    if (notifyAt > startsAt)
      return toast.error('Bildirim zamanı başlangıçtan sonra olamaz');

    const validAssignments = assignments.filter((a) => a.membershipId);
    for (const a of validAssignments) {
      if (!a.roleDefinitionId && !a.customRole.trim()) {
        return toast.error('Tüm sorumluluklar için rol seçin');
      }
    }

    setSubmitting(true);
    try {
      await createEvent(token, associationId, {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        location: location.trim() || undefined,
        startsAt: startsAt.toISOString(),
        notifyAt: notifyAt.toISOString(),
        recurrenceType: recurrence,
        recurrenceInterval: 1,
        assignments: validAssignments.map<EventAssignmentInput>((a) => ({
          membershipId: a.membershipId,
          roleDefinitionId: a.roleDefinitionId || undefined,
          customRole:
            !a.roleDefinitionId && a.customRole.trim()
              ? a.customRole.trim()
              : undefined,
          notes: a.notes.trim() || undefined,
        })),
        expenseAmount: expenseAmount
          ? Math.round(parseFloat(expenseAmount) * 100)
          : undefined,
        expenseNote: expenseNote.trim() || undefined,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Yeni Etkinlik</DialogTitle>
          <DialogDescription>
            Etkinlik bilgilerini girin ve sorumluluk dağıtımını yapın.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Başlık</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Cuma Sohbeti"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tür</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as EventTypeValue)}
              >
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Yer</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Dernek salonu"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Başlangıç</Label>
              <DateTimePicker value={startsAt} onChange={setStartsAt} />
            </div>
            <div className="space-y-1.5">
              <Label>Bildirim Zamanı</Label>
              <DateTimePicker value={notifyAt} onChange={setNotifyAt} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Açıklama</Label>
            <Textarea
              id="description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="expenseAmount">Harcama (TL)</Label>
              <Input
                id="expenseAmount"
                type="number"
                step="0.01"
                min="0"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expenseNote">Harcama Notu</Label>
              <Input
                id="expenseNote"
                value={expenseNote}
                onChange={(e) => setExpenseNote(e.target.value)}
                placeholder="Örn. Catering, dekorasyon"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sorumluluklar</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setAssignments((a) => [
                    ...a,
                    {
                      membershipId: '',
                      roleDefinitionId: '',
                      customRole: '',
                      notes: '',
                    },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Ekle
              </Button>
            </div>
            <div className="space-y-2">
              {assignments.map((a, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 items-start gap-2 rounded-md border border-border p-2"
                >
                  <div className="col-span-5">
                    <Select
                      value={a.membershipId}
                      onValueChange={(v) =>
                        setAssignments((arr) =>
                          arr.map((x, i) =>
                            i === idx ? { ...x, membershipId: v } : x,
                          ),
                        )
                      }
                    >
                      <SelectTrigger>
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
                  </div>
                  <div className="col-span-6">
                    {roles.length > 0 ? (
                      <Select
                        value={a.roleDefinitionId}
                        onValueChange={(v) =>
                          setAssignments((arr) =>
                            arr.map((x, i) =>
                              i === idx
                                ? { ...x, roleDefinitionId: v, customRole: '' }
                                : x,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
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
                        value={a.customRole}
                        onChange={(e) =>
                          setAssignments((arr) =>
                            arr.map((x, i) =>
                              i === idx
                                ? { ...x, customRole: e.target.value }
                                : x,
                            ),
                          )
                        }
                        placeholder="Rol (örn. Ses Sistemi)"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    className="col-span-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                    onClick={() =>
                      setAssignments((arr) => arr.filter((_, i) => i !== idx))
                    }
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {assignments.length === 0 && (
                <p className="rounded-md border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
                  Henüz sorumluluk yok. Sonradan da ekleyebilirsiniz.
                </p>
              )}
              {roles.length === 0 && assignments.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Bu derneğin rol kataloğu boş. Rolleri serbest yazıyorsunuz.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Kaydediliyor…' : 'Oluştur'}
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
        expenseAmount: editExpenseAmount
          ? Math.round(parseFloat(editExpenseAmount) * 100)
          : null,
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
          <div className="py-10 text-center text-sm text-muted-foreground">
            Yükleniyor…
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-2">
                <DialogTitle className="text-xl">{event.title}</DialogTitle>
                <Badge variant="secondary">
                  {EVENT_TYPE_LABELS[event.type]}
                </Badge>
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
              {event.location && (
                <Meta icon={MapPin} label="Yer" value={event.location} />
              )}
              <Meta
                icon={Repeat}
                label="Tekrar"
                value={RECURRENCE_LABELS[event.recurrenceType]}
              />
              <Meta
                icon={BarChart3}
                label="Harcama"
                value={
                  event.expenseAmount != null && event.expenseAmount > 0
                    ? `${(event.expenseAmount / 100).toFixed(2)} TL`
                    : '—'
                }
              />
            </div>
            {event.expenseNote && !editingExpense && (
              <p className="text-xs text-muted-foreground">
                {event.expenseNote}
              </p>
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
                  Harcamayı Düzenle
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
                  <Button
                    size="sm"
                    onClick={handleSaveExpense}
                    disabled={savingExpense}
                  >
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAdding(true)}
                  >
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
                          <div className="text-xs italic text-muted-foreground">
                            {a.notes}
                          </div>
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
                      await addEventAssignment(
                        token,
                        associationId,
                        eventId,
                        input,
                      );
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
              <IslamicInfoSuggestionsDialog
                eventTitle={event.title}
                eventType={event.type}
              />
              <Button
                variant="outline"
                onClick={handlePdf}
                disabled={pdfBusy}
              >
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
      <div className="grid grid-cols-2 gap-2">
        <Select value={membershipId} onValueChange={setMembershipId}>
          <SelectTrigger>
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
            <SelectTrigger>
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
