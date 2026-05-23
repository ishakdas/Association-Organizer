'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, UserMinus, Loader2, Plus, X } from 'lucide-react';
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useMembers, useRemoveMember, useUpdateMember } from '../_hooks/use-members';
import { useTitles } from '../_hooks/use-titles';
import { AddMemberDialog } from './add-member-dialog';
import type { MemberResponse, MembershipRole } from '@ticketbot/shared-validation';
import { toast } from 'sonner';

const ROLE_LABEL: Record<MembershipRole, string> = {
  SYSTEM_ADMIN: 'Sistem Yöneticisi',
  ASSOCIATION_MANAGER: 'Başkan',
  ASSOCIATION_SECRETARY: 'Sekreter',
  ASSOCIATION_MEMBER: 'Üye',
};

const ROLE_VARIANT: Record<
  MembershipRole,
  'default' | 'secondary' | 'outline' | 'success'
> = {
  SYSTEM_ADMIN: 'default',
  ASSOCIATION_MANAGER: 'success',
  ASSOCIATION_SECRETARY: 'default',
  ASSOCIATION_MEMBER: 'outline',
};

const secondaryTitleSchema = z
  .object({
    titleId: z.string().optional(),
    customTitle: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.titleId && (!v.customTitle || v.customTitle.trim().length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customTitle'],
        message: 'Bir ünvan seçin veya yazın',
      });
    }
  });

type SecondaryTitleFormValues = z.infer<typeof secondaryTitleSchema>;

function AddSecondaryTitleDialog({
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

  const form = useForm<SecondaryTitleFormValues>({
    resolver: zodResolver(secondaryTitleSchema),
    defaultValues: { titleId: undefined, customTitle: '' },
  });

  const titleId = form.watch('titleId');

  function handleSubmit(values: SecondaryTitleFormValues) {
    const existingAssignments = member.titleAssignments ?? [];
    const newTitleId = values.titleId || null;
    const newCustomTitle = values.customTitle?.trim() || null;

    const isDuplicate = existingAssignments.some(
      (t) =>
        (newTitleId && t.titleId === newTitleId) ||
        (newCustomTitle && t.customTitle === newCustomTitle),
    );

    if (isDuplicate) {
      const dupLabel = newTitleId
        ? titles?.find((t) => t.id === newTitleId)?.name ?? 'bu ünvan'
        : newCustomTitle;
      toast.error(`"${dupLabel}" zaten bu üyeye atanmış`);
      return;
    }

    const maxSort = existingAssignments.reduce(
      (max, t) => Math.max(max, t.sortOrder ?? 0),
      0,
    );

    const newAssignment = {
      titleId: newTitleId,
      customTitle: newCustomTitle,
      isPrimary: false,
      sortOrder: maxSort + 1,
    };

    const updatedAssignments = [
      ...existingAssignments.map((t) => ({
        titleId: t.titleId,
        customTitle: t.customTitle,
        isPrimary: t.isPrimary,
        sortOrder: t.sortOrder ?? 0,
      })),
      newAssignment,
    ];

    mutation.mutate(
      {
        membershipId: member.id,
        input: { titleAssignments: updatedAssignments },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>İkincil Ünvan Ekle</DialogTitle>
          <DialogDescription>
            {member.user.fullName} için ek sorumluluk alanı tanımlayın.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="titleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unvan</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Unvan seç" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {titles?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">Diğer (yaz)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Kayıtlı unvanlardan seçin veya &ldquo;Diğer&rdquo; ile özel yazın.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {titleId === '__custom__' && (
              <FormField
                control={form.control}
                name="customTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Özel Unvan *</FormLabel>
                    <FormControl>
                      <Input placeholder="Örn. Bölge Temsilcisi" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                  <Plus className="h-3.5 w-3.5" />
                )}
                Ekle
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function MembersCard({ associationId }: { associationId: string }) {
  const { data: members, isLoading, isError, error } = useMembers(associationId);
  const removeMutation = useRemoveMember(associationId);
  const [addingSecondaryFor, setAddingSecondaryFor] = useState<MemberResponse | null>(null);

  function handleRemove(member: MemberResponse) {
    const ok = window.confirm(
      `${member.user.fullName} dernekten çıkarılsın mı? (Üyelik pasifleştirilir, kayıt silinmez.)`,
    );
    if (ok) removeMutation.mutate(member.id);
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[14px] font-semibold tracking-tight">
            Üyeler
            {members && (
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                ({members.length})
              </span>
            )}
          </h2>
        </div>
        <AddMemberDialog associationId={associationId} />
      </header>

      {isLoading && (
        <div className="space-y-2 p-5">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}

      {isError && (
        <p className="px-5 py-8 text-center text-sm text-destructive">
          Üyeler yüklenemedi: {error.message}
        </p>
      )}

      {members && members.length === 0 && (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">
          Henüz üye yok. Sağ üstten ilk kişiyi ekleyin.
        </p>
      )}

      {members && members.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>İsim</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Unvanlar</TableHead>
              <TableHead>İletişim</TableHead>
              <TableHead className="text-right">Katılım</TableHead>
              <TableHead className="w-[1%]" aria-label="Eylemler" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const isRemoving =
                removeMutation.isPending && removeMutation.variables === m.id;
              const primary = m.titleAssignments?.find((t) => t.isPrimary);
              const secondaries = m.titleAssignments?.filter((t) => !t.isPrimary) ?? [];
              const primaryLabel = primary?.title?.name ?? primary?.customTitle;
              const canAddSecondary = secondaries.length < 2;

              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.user.fullName}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_VARIANT[m.role]}>
                      {ROLE_LABEL[m.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    <div className="space-y-0.5">
                      {primaryLabel && (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                          <span className="font-medium text-foreground">{primaryLabel}</span>
                        </div>
                      )}
                      {secondaries.map((s) => {
                        const label = s.title?.name ?? s.customTitle;
                        return label ? (
                          <div key={s.id} className="flex items-center gap-1.5">
                            <span className="flex items-center gap-1 pl-3.5">
                              <span className="h-4 w-px bg-foreground/60" />
                              <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-foreground/50 bg-foreground/20" />
                            </span>
                            <span className="text-foreground">{label}</span>
                          </div>
                        ) : null;
                      })}
                      {!primaryLabel && secondaries.length === 0 && (
                        <span>—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {m.user.email && (
                      <span className="block">{m.user.email}</span>
                    )}
                    {m.user.phone && (
                      <span className="block font-mono text-[12px]">
                        {m.user.phone}
                      </span>
                    )}
                    {!m.user.email && !m.user.phone && '—'}
                  </TableCell>
                  <TableCell className="text-right text-[12.5px] text-muted-foreground">
                    {new Date(m.joinedAt).toLocaleDateString('tr-TR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canAddSecondary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setAddingSecondaryFor(m)}
                          aria-label={`${m.user.fullName} için ikincil ünvan ekle`}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          İkincil Ünvan
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(m)}
                        disabled={isRemoving}
                        aria-label={`${m.user.fullName} adlı üyeyi çıkar`}
                      >
                        {isRemoving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserMinus className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1.5">Çıkar</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {addingSecondaryFor && (
        <AddSecondaryTitleDialog
          associationId={associationId}
          member={addingSecondaryFor}
          open
          onOpenChange={(open) => { if (!open) setAddingSecondaryFor(null); }}
        />
      )}
    </section>
  );
}
