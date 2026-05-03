'use client';

import { useMemo, useState } from 'react';
import {
  Briefcase,
  Crown,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Save,
  Send,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMembers, useRemoveMember, useUpdateMember } from '../../_hooks/use-members';
import { useTitles } from '../../_hooks/use-titles';
import { AddMemberDialog } from '../add-member-dialog';
import { TelegramLinkDialog } from './telegram-link-dialog';
import type { MemberResponse } from '@ticketbot/shared-validation';

const NO_TITLE = '__all__';

interface RosterSectionProps {
  associationId: string;
  canManage: boolean;
  canManageManager?: boolean;
}

export function RosterSection({ associationId, canManage, canManageManager = false }: RosterSectionProps) {
  const { data: managers, isLoading: loadingManagers } = useMembers(associationId, { role: 'ASSOCIATION_MANAGER' });
  const { data: secretaries, isLoading: loadingSecretaries } = useMembers(associationId, { role: 'ASSOCIATION_SECRETARY' });
  const { data: members, isLoading: loadingMembers, isError, error } = useMembers(associationId, { role: 'ASSOCIATION_MEMBER' });
  const removeMutation = useRemoveMember(associationId);
  const { data: titles } = useTitles();

  const [search, setSearch] = useState('');
  const [titleId, setTitleId] = useState<string>(NO_TITLE);
  const [telegramFor, setTelegramFor] = useState<MemberResponse | null>(null);
  const [editingMember, setEditingMember] = useState<MemberResponse | null>(null);

  const manager = managers?.[0] ?? null;

  const filteredMembers = useMemo(() => {
    if (!members) return members;
    let rows = members;
    if (search.trim()) {
      const q = search.trim().toLocaleLowerCase('tr-TR');
      rows = rows.filter(
        (m) =>
          m.user.fullName.toLocaleLowerCase('tr-TR').includes(q) ||
          (m.user.email ?? '').toLocaleLowerCase('tr-TR').includes(q),
      );
    }
    if (titleId !== NO_TITLE) {
      rows = rows.filter((m) => m.title?.id === titleId);
    }
    return rows;
  }, [members, search, titleId]);

  function handleRemove(m: MemberResponse) {
    const ok = window.confirm(
      `${m.user.fullName} dernekten çıkarılsın mı? (Üyelik pasifleştirilir, kayıt silinmez.)`,
    );
    if (ok) removeMutation.mutate(m.id);
  }

  const isLoading = loadingManagers || loadingMembers;

  return (
    <div className="space-y-6">
      {/* Başkan Card */}
      <section className="rounded-lg border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <h2 className="text-[14px] font-semibold tracking-tight">Başkan</h2>
          </div>
          {canManageManager && (
            <AddMemberDialog
              associationId={associationId}
              defaultRole="ASSOCIATION_MANAGER"
              triggerLabel={manager ? 'Başkan değiştir' : 'Başkan ata'}
            />
          )}
        </header>
        <div className="px-5 py-5">
          {loadingManagers && <Skeleton className="h-16 w-full" />}
          {!loadingManagers && !manager && (
            <p className="text-center text-sm text-muted-foreground py-4">
              Bu derneğin aktif başkanı yok.
            </p>
          )}
          {manager && (
            <ManagerCard
              m={manager}
              canManage={canManageManager}
              onRemove={() => handleRemove(manager)}
              onEdit={() => setEditingMember(manager)}
              onGenerateTelegram={() => setTelegramFor(manager)}
              isRemoving={removeMutation.isPending && removeMutation.variables === manager.id}
            />
          )}
        </div>
      </section>

      {/* Sekreterler */}
      <section className="rounded-lg border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[14px] font-semibold tracking-tight">
              Sekreterler
              {secretaries && secretaries.length > 0 && (
                <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                  ({secretaries.length})
                </span>
              )}
            </h2>
          </div>
          {canManage && (
            <AddMemberDialog
              associationId={associationId}
              defaultRole="ASSOCIATION_SECRETARY"
              triggerLabel="Sekreter ekle"
            />
          )}
        </header>

        {loadingSecretaries && (
          <div className="space-y-2 p-5">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {!loadingSecretaries && (!secretaries || secretaries.length === 0) && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Bu derneğin aktif sekreteri yok.
          </p>
        )}

        {secretaries && secretaries.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>İsim</TableHead>
                <TableHead>İletişim</TableHead>
                <TableHead className="text-right">Katılım</TableHead>
                {canManage && <TableHead className="w-[1%]" aria-label="Eylemler" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {secretaries.map((m) => {
                const isRemoving =
                  removeMutation.isPending && removeMutation.variables === m.id;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.user.fullName}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {m.user.email && <span className="block">{m.user.email}</span>}
                      {m.user.phone && (
                        <span className="block font-mono text-[12px]">{m.user.phone}</span>
                      )}
                      {m.user.telegramAccount && (
                        <Badge
                          variant="success"
                          className="mt-1 inline-flex items-center gap-1"
                        >
                          <Send className="h-3 w-3" />
                          Telegram
                        </Badge>
                      )}
                      {!m.user.email && !m.user.phone && !m.user.telegramAccount && '—'}
                    </TableCell>
                    <TableCell className="text-right text-[12.5px] text-muted-foreground">
                      {new Date(m.joinedAt).toLocaleDateString('tr-TR')}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingMember(m)}
                            aria-label={`${m.user.fullName} bilgilerini düzenle`}
                            title="Bilgileri düzenle"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTelegramFor(m)}
                            aria-label={`${m.user.fullName} için Telegram kodu üret`}
                            title="Telegram bağlantı kodu üret"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(m)}
                            disabled={isRemoving}
                            aria-label={`${m.user.fullName} adlı kişiyi çıkar`}
                          >
                            {isRemoving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserMinus className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Üyeler Table */}
      <section className="rounded-lg border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[14px] font-semibold tracking-tight">
              Üyeler
              {filteredMembers && filteredMembers.length > 0 && (
                <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                  ({filteredMembers.length})
                </span>
              )}
            </h2>
          </div>
          {canManage && (
            <AddMemberDialog
              associationId={associationId}
              defaultRole="ASSOCIATION_MEMBER"
              triggerLabel="Üye ekle"
            />
          )}
        </header>

        {members && members.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad veya e-posta ara…"
              className="h-9 max-w-[280px]"
            />
            <Select value={titleId} onValueChange={setTitleId}>
              <SelectTrigger className="h-9 max-w-[220px]">
                <SelectValue placeholder="Tüm unvanlar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TITLE}>Tüm unvanlar</SelectItem>
                {titles?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isLoading && (
          <div className="space-y-2 p-5">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {isError && (
          <p className="px-5 py-8 text-center text-sm text-destructive">
            Liste yüklenemedi: {error.message}
          </p>
        )}

        {filteredMembers && filteredMembers.length === 0 && !isLoading && (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            {members && members.length === 0 ? 'Henüz üye yok.' : 'Filtreye uyan kayıt yok.'}
          </p>
        )}

        {filteredMembers && filteredMembers.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>İsim</TableHead>
                <TableHead>Unvan</TableHead>
                <TableHead>İletişim</TableHead>
                <TableHead className="text-right">Katılım</TableHead>
                {canManage && <TableHead className="w-[1%]" aria-label="Eylemler" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((m) => {
                const isRemoving =
                  removeMutation.isPending && removeMutation.variables === m.id;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.user.fullName}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {m.title?.name ?? m.customTitle ?? '—'}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {m.user.email && <span className="block">{m.user.email}</span>}
                      {m.user.phone && (
                        <span className="block font-mono text-[12px]">{m.user.phone}</span>
                      )}
                      {m.user.address && (
                        <span className="block text-[12px]">{m.user.address}</span>
                      )}
                      {m.user.telegramAccount && (
                        <Badge
                          variant="success"
                          className="mt-1 inline-flex items-center gap-1"
                        >
                          <Send className="h-3 w-3" />
                          Telegram
                        </Badge>
                      )}
                      {!m.user.email && !m.user.phone && !m.user.telegramAccount && '—'}
                    </TableCell>
                    <TableCell className="text-right text-[12.5px] text-muted-foreground">
                      {new Date(m.joinedAt).toLocaleDateString('tr-TR')}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingMember(m)}
                            aria-label={`${m.user.fullName} bilgilerini düzenle`}
                            title="Bilgileri düzenle"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTelegramFor(m)}
                            aria-label={`${m.user.fullName} için Telegram kodu üret`}
                            title="Telegram bağlantı kodu üret"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(m)}
                            disabled={isRemoving}
                            aria-label={`${m.user.fullName} adlı kişiyi çıkar`}
                          >
                            {isRemoving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserMinus className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <TelegramLinkDialog
        associationId={associationId}
        member={telegramFor}
        open={telegramFor !== null}
        onOpenChange={(open) => { if (!open) setTelegramFor(null); }}
      />

      {editingMember && (
        <EditMemberDialog
          associationId={associationId}
          member={editingMember}
          open
          onOpenChange={(open) => { if (!open) setEditingMember(null); }}
        />
      )}
    </div>
  );
}

function ManagerCard({
  m,
  canManage,
  onRemove,
  onEdit,
  onGenerateTelegram,
  isRemoving,
}: {
  m: MemberResponse;
  canManage: boolean;
  onRemove: () => void;
  onEdit: () => void;
  onGenerateTelegram: () => void;
  isRemoving: boolean;
}) {
  const initials = m.user.fullName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-background p-5 sm:flex-row sm:items-start">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[15px] font-semibold tracking-tight text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        {initials}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
            {m.user.fullName}
          </h3>
          <Badge variant="success">Aktif</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
          {m.user.email && (
            <a href={`mailto:${m.user.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
              <Mail className="h-3.5 w-3.5" />
              {m.user.email}
            </a>
          )}
          {m.user.phone && (
            <a href={`tel:${m.user.phone}`} className="inline-flex items-center gap-1.5 font-mono hover:text-foreground">
              <Phone className="h-3.5 w-3.5" />
              {m.user.phone}
            </a>
          )}
          {m.user.address && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {m.user.address}
            </span>
          )}
          {m.user.telegramAccount && (
            <Badge variant="success" className="inline-flex items-center gap-1">
              <Send className="h-3 w-3" />
              Telegram
            </Badge>
          )}
        </div>
        <div className="text-[12px] text-muted-foreground">
          Katılım: {new Date(m.joinedAt).toLocaleDateString('tr-TR')}
        </div>
      </div>
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Düzenle
          </Button>
          <Button variant="outline" size="sm" onClick={onGenerateTelegram}>
            <Send className="h-3.5 w-3.5" />
            Telegram kodu
          </Button>
          <Button variant="outline" size="sm" onClick={onRemove} disabled={isRemoving}>
            {isRemoving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserMinus className="h-3.5 w-3.5" />
            )}
            Görevden al
          </Button>
        </div>
      )}
    </div>
  );
}

const EDIT_NO_TITLE = '__none__';
const EDIT_CUSTOM_TITLE = '__custom__';

const editMemberFormSchema = z
  .object({
    fullName: z.string().min(2, 'En az 2 karakter').max(200),
    phone: z.string().optional(),
    address: z.string().max(500).optional(),
    titleId: z.string().optional(),
    customTitle: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.titleId === EDIT_CUSTOM_TITLE) {
      if (!v.customTitle || v.customTitle.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customTitle'],
          message: 'Unvanı yazın (en az 2 karakter)',
        });
      }
    }
  });

type EditMemberFormValues = z.infer<typeof editMemberFormSchema>;

function EditMemberDialog({
  associationId,
  member,
  open,
  onOpenChange,
}: {
  associationId: string;
  member: MemberResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useUpdateMember(associationId);
  const { data: titles } = useTitles();

  const currentTitleId = member.title
    ? member.title.id
    : member.customTitle
      ? EDIT_CUSTOM_TITLE
      : EDIT_NO_TITLE;

  const form = useForm<EditMemberFormValues>({
    resolver: zodResolver(editMemberFormSchema),
    defaultValues: {
      fullName: member.user.fullName,
      phone: member.user.phone ?? '',
      address: member.user.address ?? '',
      titleId: currentTitleId,
      customTitle: member.customTitle ?? '',
    },
  });

  const titleId = form.watch('titleId');

  function handleSubmit(values: EditMemberFormValues) {
    const useCustom = values.titleId === EDIT_CUSTOM_TITLE;
    const titleIdValue =
      values.titleId && values.titleId !== EDIT_NO_TITLE && values.titleId !== EDIT_CUSTOM_TITLE
        ? values.titleId
        : null;

    mutation.mutate(
      {
        membershipId: member.id,
        input: {
          fullName: values.fullName.trim(),
          phone: values.phone?.trim() || undefined,
          address: values.address?.trim() || null,
          titleId: titleIdValue,
          customTitle: useCustom ? values.customTitle?.trim() || null : null,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  const isManager = member.role === 'ASSOCIATION_MANAGER';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Üye Bilgilerini Düzenle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ad Soyad *</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefon</FormLabel>
                    <FormControl>
                      <PhoneInput
                        name={field.name}
                        onBlur={field.onBlur}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adres</FormLabel>
                    <FormControl>
                      <Input placeholder="İl, ilçe, mahalle…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {!isManager && (
              <>
                <FormField
                  control={form.control}
                  name="titleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unvan</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? EDIT_NO_TITLE}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Unvan seç (opsiyonel)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={EDIT_NO_TITLE}>— Yok —</SelectItem>
                          {titles?.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                          <SelectItem value={EDIT_CUSTOM_TITLE}>Diğer (yaz)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Önce kayıtlı unvanlardan seçin; yoksa &ldquo;Diğer&rdquo; ile özel unvan yazın.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {titleId === EDIT_CUSTOM_TITLE && (
                  <FormField
                    control={form.control}
                    name="customTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Özel Unvan *</FormLabel>
                        <FormControl>
                          <Input placeholder="Örn. Onur Üyesi" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                <X className="h-3.5 w-3.5" />
                Vazgeç
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
