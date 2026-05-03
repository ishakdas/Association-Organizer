'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { MembershipRole } from '@ticketbot/shared-validation';
import { Briefcase, Loader2, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAddMember } from '../_hooks/use-members';
import { useTitles } from '../_hooks/use-titles';
import { PasswordField } from './password-field';
import { CredentialsSuccessDialog } from './credentials-success-dialog';

const NO_TITLE = '__none__';
const CUSTOM_TITLE = '__custom__';

type Mode = 'secretary' | 'member';

const formSchema = z
  .object({
    mode: z.enum(['secretary', 'member']),
    fullName: z.string().min(2, 'En az 2 karakter').max(200),
    email: z.string().email('Geçerli e-posta').optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().max(500).optional(),
    titleId: z.string().optional(),
    customTitle: z.string().optional(),
    password: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'secretary') {
      if (!v.email || !v.email.includes('@')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['email'],
          message: 'Sekreter için geçerli e-posta zorunlu',
        });
      }
      if (!v.password || v.password.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['password'],
          message: 'En az 8 karakter',
        });
      }
    }
    if (v.mode === 'member' && v.titleId === CUSTOM_TITLE) {
      if (!v.customTitle || v.customTitle.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customTitle'],
          message: 'Unvanı yazın (en az 2 karakter)',
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

export function AddMemberDialog({
  associationId,
  defaultRole = 'ASSOCIATION_MEMBER',
  triggerLabel = 'Üye Ekle',
}: {
  associationId: string;
  defaultRole?: MembershipRole;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
    fullName: string;
  } | null>(null);
  const { data: titles } = useTitles();

  // Manager mode locks to 'member' (manager has its own dedicated flow without
  // Supabase provisioning here). Secretary trigger starts in secretary mode.
  // Member trigger starts in member mode but lets the operator switch.
  const initialMode: Mode =
    defaultRole === 'ASSOCIATION_SECRETARY' ? 'secretary' : 'member';
  const allowModeToggle = defaultRole !== 'ASSOCIATION_MANAGER';

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mode: initialMode,
      fullName: '',
      email: '',
      phone: '',
      address: '',
      titleId: NO_TITLE,
      customTitle: '',
      password: '',
    },
  });

  const mode = form.watch('mode');
  const titleId = form.watch('titleId');

  // Wipe role-specific fields when toggling so a stale secretary password
  // never leaks into a member POST and vice versa.
  useEffect(() => {
    if (mode === 'member') form.setValue('password', '');
    if (mode === 'secretary') {
      form.setValue('titleId', NO_TITLE);
      form.setValue('customTitle', '');
    }
  }, [mode, form]);

  function resetForm() {
    form.reset({
      mode: initialMode,
      fullName: '',
      email: '',
      phone: '',
      address: '',
      titleId: NO_TITLE,
      customTitle: '',
      password: '',
    });
  }

  const mutation = useAddMember(associationId, {
    onSuccess: (member) => {
      const v = form.getValues();
      if (v.mode === 'secretary' && v.password) {
        // Hand off the temp password through the credentials dialog before
        // resetting — operator must acknowledge before it disappears.
        setCredentials({
          email: v.email!,
          password: v.password,
          fullName: member.user.fullName,
        });
      } else {
        resetForm();
        setOpen(false);
      }
    },
  });

  function onSubmit(values: FormValues) {
    const isSecretary = values.mode === 'secretary';
    const useCustom = !isSecretary && values.titleId === CUSTOM_TITLE;
    const titleIdValue =
      !isSecretary &&
      values.titleId &&
      values.titleId !== NO_TITLE &&
      values.titleId !== CUSTOM_TITLE
        ? values.titleId
        : undefined;

    const role: MembershipRole = isSecretary
      ? 'ASSOCIATION_SECRETARY'
      : defaultRole === 'ASSOCIATION_MANAGER'
        ? 'ASSOCIATION_MANAGER'
        : 'ASSOCIATION_MEMBER';

    mutation.mutate({
      fullName: values.fullName,
      email: values.email || undefined,
      phone: values.phone || undefined,
      address: values.address || undefined,
      role,
      titleId: titleIdValue,
      customTitle: useCustom ? values.customTitle?.trim() : undefined,
      password: isSecretary ? values.password : undefined,
    });
  }

  function handleAcknowledge() {
    setCredentials(null);
    resetForm();
    setOpen(false);
  }

  const showTitleFields =
    defaultRole !== 'ASSOCIATION_MANAGER' && mode === 'member';

  const dialogTitle =
    defaultRole === 'ASSOCIATION_MANAGER'
      ? 'Başkan Ata'
      : mode === 'secretary'
        ? 'Sekreter Ekle'
        : 'Üye Ekle';

  const dialogDescription =
    defaultRole === 'ASSOCIATION_MANAGER'
      ? 'Başkan bilgilerini girin.'
      : mode === 'secretary'
        ? 'Sekreter eklendiğinde web hesabı açılır ve geçici şifre üretilir.'
        : 'Üye olarak kaydedilir; giriş hesabı oluşturulmaz.';

  return (
    <>
      <Dialog
        open={open && !credentials}
        onOpenChange={(o) => {
          if (credentials) return; // block dismiss while temp password is shown
          setOpen(o);
        }}
      >
        <DialogTrigger asChild>
          <Button size="sm">
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            {triggerLabel}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {allowModeToggle && (
                <FormField
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Tür</FormLabel>
                      <FormControl>
                        <ModeToggle
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ad Soyad *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ali Veli" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      E-posta {mode === 'secretary' && '*'}
                    </FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="ali@..." autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            </div>

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

            {mode === 'secretary' && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geçici Şifre *</FormLabel>
                    <FormControl>
                      <PasswordField
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {showTitleFields && (
              <>
                <FormField
                  control={form.control}
                  name="titleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unvan</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? NO_TITLE}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Unvan seç (opsiyonel)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_TITLE}>— Yok —</SelectItem>
                          {titles?.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                          <SelectItem value={CUSTOM_TITLE}>Diğer (yaz)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Önce kayıtlı unvanlardan seçin; yoksa &ldquo;Diğer&rdquo; ile özel unvan yazın.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {titleId === CUSTOM_TITLE && (
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
                  onClick={() => setOpen(false)}
                  disabled={mutation.isPending}
                >
                  Vazgeç
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Ekleniyor…
                    </>
                  ) : defaultRole === 'ASSOCIATION_MANAGER' ? (
                    'Başkan Olarak Ata'
                  ) : mode === 'secretary' ? (
                    'Sekreter Olarak Ekle'
                  ) : (
                    'Üye Olarak Ekle'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {credentials && (
        <CredentialsSuccessDialog
          open
          title={`${credentials.fullName} eklendi`}
          description="Sekreterin web hesabı açıldı. Aşağıdaki bilgileri güvenli bir kanaldan iletin."
          email={credentials.email}
          password={credentials.password}
          onAcknowledge={handleAcknowledge}
        />
      )}
    </>
  );
}

function ModeToggle({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (next: Mode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ModeCard
        active={value === 'secretary'}
        onClick={() => onChange('secretary')}
        icon={<Briefcase className="h-4 w-4" />}
        title="Sekreter"
        subtitle="Web hesabı açılır, geçici şifre üretilir."
      />
      <ModeCard
        active={value === 'member'}
        onClick={() => onChange('member')}
        icon={<Users className="h-4 w-4" />}
        title="Üye"
        subtitle="Yalnızca dernek kayıtlarına işlenir."
      />
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-full flex-col gap-1.5 rounded-md border p-3 text-left transition-colors',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
          : 'border-border bg-background hover:border-foreground/30',
      )}
      aria-pressed={active}
    >
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <span className={active ? 'text-primary' : 'text-muted-foreground'}>
          {icon}
        </span>
        {title}
      </div>
      <p className="text-[11.5px] leading-snug text-muted-foreground">
        {subtitle}
      </p>
    </button>
  );
}
