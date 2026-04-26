'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  addMemberSchema,
  type MembershipRole,
} from '@ticketbot/shared-validation';
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
    email: z.string().optional(),
    phone: z
      .string()
      .optional()
      .refine(
        (v) => !v || /^0\d{10}$/.test(v),
        'Telefon 11 haneli olmalı (0 ile başlamalı)',
      ),
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

  const initialMode: Mode =
    defaultRole === 'ASSOCIATION_SECRETARY' ? 'secretary' : 'member';

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mode: initialMode,
      fullName: '',
      email: '',
      phone: '',
      titleId: NO_TITLE,
      customTitle: '',
      password: '',
    },
  });

  const mode = form.watch('mode');
  const titleId = form.watch('titleId');

  // Reset role-specific fields when toggling between modes so stale
  // values (e.g. an old secretary password) don't leak into a new member.
  useEffect(() => {
    if (mode === 'member') form.setValue('password', '');
    if (mode === 'secretary') {
      form.setValue('titleId', NO_TITLE);
      form.setValue('customTitle', '');
    }
  }, [mode, form]);

  const mutation = useAddMember(associationId, {
    onSuccess: (member) => {
      const v = form.getValues();
      if (v.mode === 'secretary' && v.password) {
        setCredentials({
          email: v.email!,
          password: v.password,
          fullName: member.user.fullName,
        });
        // Keep the parent dialog closed; credentials dialog blocks until ack.
      } else {
        form.reset({
          mode: initialMode,
          fullName: '',
          email: '',
          phone: '',
          titleId: NO_TITLE,
          customTitle: '',
          password: '',
        });
        setOpen(false);
      }
    },
  });

  function onSubmit(values: FormValues) {
    const role: MembershipRole =
      values.mode === 'secretary'
        ? 'ASSOCIATION_SECRETARY'
        : defaultRole === 'ASSOCIATION_MANAGER'
          ? 'ASSOCIATION_MANAGER'
          : 'ASSOCIATION_MEMBER';

    const useCustom = values.mode === 'member' && values.titleId === CUSTOM_TITLE;
    const titleIdValue =
      values.mode === 'member' &&
      values.titleId &&
      values.titleId !== NO_TITLE &&
      values.titleId !== CUSTOM_TITLE
        ? values.titleId
        : undefined;

    const parsed = addMemberSchema.safeParse({
      fullName: values.fullName,
      email: values.email || undefined,
      phone: values.phone || undefined,
      role,
      titleId: titleIdValue,
      customTitle: useCustom ? values.customTitle?.trim() : undefined,
      password: values.mode === 'secretary' ? values.password : undefined,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        const map: Record<string, keyof FormValues> = {
          fullName: 'fullName',
          email: 'email',
          phone: 'phone',
          password: 'password',
          customTitle: 'customTitle',
          titleId: 'titleId',
        };
        if (typeof path === 'string' && map[path]) {
          form.setError(map[path], { message: issue.message });
        }
      }
      return;
    }

    mutation.mutate(parsed.data);
  }

  function handleAcknowledge() {
    setCredentials(null);
    form.reset({
      mode: initialMode,
      fullName: '',
      email: '',
      phone: '',
      titleId: NO_TITLE,
      customTitle: '',
      password: '',
    });
    setOpen(false);
  }

  return (
    <>
      <Dialog
        open={open && !credentials}
        onOpenChange={(o) => {
          if (credentials) return; // can't dismiss parent while credentials open
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
            <DialogTitle>Yeni kişi ekle</DialogTitle>
            <DialogDescription>
              Sekreter eklerseniz Supabase hesabı açılır ve geçici şifre
              üretilir. Üye eklerseniz yalnızca dernek kayıtlarına işlenir.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Tür</FormLabel>
                    <FormControl>
                      <ModeToggle value={field.value} onChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

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
                        <Input
                          type="email"
                          placeholder="ali@..."
                          autoComplete="off"
                          {...field}
                        />
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

              {mode === 'member' && (
                <>
                  <FormField
                    control={form.control}
                    name="titleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unvan</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? NO_TITLE}
                        >
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
                            <SelectItem value={CUSTOM_TITLE}>
                              Diğer (yaz)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Önce kayıtlı unvanlardan seçin; yoksa &ldquo;Diğer&rdquo;
                          ile özel unvan yazın.
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
                            <Input
                              placeholder="Örn. Onur Üyesi"
                              {...field}
                            />
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
                  ) : mode === 'secretary' ? (
                    'Sekreter olarak ekle'
                  ) : (
                    'Üye olarak ekle'
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
    <div role="radiogroup" className="grid grid-cols-2 gap-2">
      <ModeOption
        value="secretary"
        current={value}
        onChange={onChange}
        icon={Briefcase}
        title="Sekreter"
        hint="Web hesabı açılır"
      />
      <ModeOption
        value="member"
        current={value}
        onChange={onChange}
        icon={Users}
        title="Üye"
        hint="Yalnızca kayıt"
      />
    </div>
  );
}

function ModeOption({
  value,
  current,
  onChange,
  icon: Icon,
  title,
  hint,
}: {
  value: Mode;
  current: Mode;
  onChange: (next: Mode) => void;
  icon: typeof Briefcase;
  title: string;
  hint: string;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onChange(value)}
      className={cn(
        'flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
        active
          ? 'border-primary/40 bg-primary/[0.04]'
          : 'border-border bg-background hover:bg-accent/50',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          active
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-foreground">
          {title}
        </span>
        <span className="block text-[11.5px] text-muted-foreground">
          {hint}
        </span>
      </span>
    </button>
  );
}
