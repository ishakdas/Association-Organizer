'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Loader2,
  Save,
} from 'lucide-react';
import { useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAssociationSchema } from '@ticketbot/shared-validation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useCreateAssociation } from '../_hooks/use-create-association';
import { LogoUploader } from './logo-uploader';
import { PasswordField } from './password-field';
import { CredentialsSuccessDialog } from './credentials-success-dialog';

const formSchema = z.object({
  name: z.string().min(2, 'En az 2 karakter').max(200),
  shortName: z.string().max(50).optional(),
  taxNumber: z
    .string()
    .regex(/^\d{10}$/, 'Vergi numarası 10 haneli ve sadece rakam olmalı'),
  foundedAt: z.string().min(1, 'Kuruluş tarihi zorunlu'),
  address: z.string().min(5, 'En az 5 karakter').max(500),
  city: z.string().min(2).max(100),
  district: z.string().min(2).max(100),
  phone: z.string().min(1, 'Telefon zorunlu'),
  email: z.string().email('Geçerli bir e-posta girin'),
  website: z.string().url('Geçerli bir URL girin').or(z.literal('')).optional(),
  logoUrl: z.string().url('Geçerli bir URL girin').or(z.literal('')).optional(),
  activityArea: z.string().min(2).max(200),
  memberCount: z.coerce.number().int().nonnegative(),
  isActive: z.boolean(),
  notes: z.string().max(2000).optional(),
  // Flat manager fields keep react-hook-form's per-field error mapping
  // straightforward; nested into `manager` at submit time.
  managerFullName: z.string().min(2, 'En az 2 karakter').max(200),
  managerEmail: z.string().email('Geçerli bir e-posta girin'),
  managerPassword: z.string().min(8, 'En az 8 karakter').max(72),
  managerPhone: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const STEP_FIELDS: Record<1 | 2, FieldPath<FormValues>[]> = {
  1: [
    'name',
    'shortName',
    'taxNumber',
    'foundedAt',
    'activityArea',
    'phone',
    'email',
    'website',
    'address',
    'city',
    'district',
    'memberCount',
    'isActive',
    'logoUrl',
    'notes',
  ],
  2: ['managerFullName', 'managerEmail', 'managerPassword', 'managerPhone'],
};

const STEPS = [
  { n: 1, title: 'Dernek Bilgileri', hint: 'Sicil ve iletişim' },
  { n: 2, title: 'Başkan Bilgileri', hint: 'Hesap açılışı' },
  { n: 3, title: 'Önizleme', hint: 'Onay ve gönderim' },
] as const;

type StepNum = 1 | 2 | 3;

export function AssociationForm() {
  const router = useRouter();
  const [step, setStep] = useState<StepNum>(1);
  const [credentials, setCredentials] = useState<{
    associationId: string;
    associationName: string;
    email: string;
    password: string;
  } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      shortName: '',
      taxNumber: '',
      foundedAt: '',
      address: '',
      city: '',
      district: '',
      phone: '',
      email: '',
      website: '',
      logoUrl: '',
      activityArea: '',
      memberCount: 0,
      isActive: true,
      notes: '',
      managerFullName: '',
      managerEmail: '',
      managerPassword: '',
      managerPhone: '',
    },
  });

  const mutation = useCreateAssociation({
    onSuccess: (id) => {
      const v = form.getValues();
      setCredentials({
        associationId: id,
        associationName: v.name,
        email: v.managerEmail,
        password: v.managerPassword,
      });
    },
  });

  async function nextStep() {
    if (step === 3) return;
    const ok = await form.trigger(STEP_FIELDS[step as 1 | 2]);
    if (ok) setStep(((step as number) + 1) as StepNum);
  }

  function prevStep() {
    if (step === 1) return;
    setStep(((step as number) - 1) as StepNum);
  }

  function onSubmit(values: FormValues) {
    if (step !== 3) {
      // Defensive — submit can only fire on step 3.
      void nextStep();
      return;
    }
    const foundedAtIso = new Date(`${values.foundedAt}T00:00:00Z`).toISOString();
    const {
      managerFullName,
      managerEmail,
      managerPassword,
      managerPhone,
      ...associationFields
    } = values;

    const parsed = createAssociationSchema.safeParse({
      ...associationFields,
      foundedAt: foundedAtIso,
      website: values.website || undefined,
      logoUrl: values.logoUrl || undefined,
      notes: values.notes || undefined,
      shortName: values.shortName || undefined,
      manager: {
        fullName: managerFullName,
        email: managerEmail,
        password: managerPassword,
        phone: managerPhone || undefined,
      },
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const head = issue.path[0];
        if (head === 'manager') {
          const sub = issue.path[1];
          const map: Record<string, keyof FormValues> = {
            fullName: 'managerFullName',
            email: 'managerEmail',
            password: 'managerPassword',
            phone: 'managerPhone',
          };
          if (typeof sub === 'string' && map[sub]) {
            form.setError(map[sub], { message: issue.message });
            // Snap back to step 2 so the user can fix the field.
            setStep(2);
          }
        } else if (typeof head === 'string') {
          form.setError(head as keyof FormValues, { message: issue.message });
          setStep(1);
        }
      }
      return;
    }

    mutation.mutate(parsed.data);
  }

  function acknowledgeAndNavigate() {
    const id = credentials?.associationId;
    setCredentials(null);
    if (id) router.push(`/associations/${id}`);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        onKeyDown={(e) => {
          // Prevent Enter from auto-submitting before step 3.
          if (e.key === 'Enter' && step !== 3) {
            const tag = (e.target as HTMLElement).tagName;
            if (tag !== 'TEXTAREA') e.preventDefault();
          }
        }}
        className="pb-28"
      >
        <div className="space-y-8">
          <FormHeader step={step} />

          <div className="rounded-lg border border-border bg-card">
            {step === 1 && <StepDernek />}
            {step === 2 && <StepBaskan />}
            {step === 3 && <StepOnizleme values={form.watch()} />}
          </div>
        </div>

        <StickyFooter
          step={step}
          isPending={mutation.isPending}
          onPrev={prevStep}
          onNext={nextStep}
        />
      </form>

      {credentials && (
        <CredentialsSuccessDialog
          open={true}
          title={`"${credentials.associationName}" oluşturuldu`}
          description="Başkanın hesabı açıldı. Aşağıdaki bilgileri güvenli bir kanaldan iletin."
          email={credentials.email}
          password={credentials.password}
          onAcknowledge={acknowledgeAndNavigate}
        />
      )}
    </Form>
  );
}

function StepDernek() {
  return (
    <>
      <Section
        number="01"
        title="Kimlik"
        description="Dernek tüzel kişilik bilgileri. Bunlar sicile tek kez girilir."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Dernek Adı *</FormLabel>
                <FormControl>
                  <Input placeholder="Örnek Eğitim Derneği" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="shortName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kısa Ad</FormLabel>
                <FormControl>
                  <Input placeholder="ÖED" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="taxNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vergi Numarası *</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="1234567890"
                    className="font-mono"
                    {...field}
                  />
                </FormControl>
                <FormDescription>10 haneli, sadece rakam.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="foundedAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kuruluş Tarihi *</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="activityArea"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Faaliyet Alanı *</FormLabel>
                <FormControl>
                  <Input placeholder="Eğitim, Sağlık, Sosyal Yardım…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Section>

      <Separator />

      <Section
        number="02"
        title="İletişim"
        description="Üyeler ve başvuranlar bu bilgiler üzerinden ulaşır."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefon *</FormLabel>
                <FormControl>
                  <Input placeholder="0555 111 22 33" {...field} />
                </FormControl>
                <FormDescription>
                  Otomatik olarak +90 formatına çevrilir.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-posta *</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="info@dernek.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="website"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Web Sitesi</FormLabel>
                <FormControl>
                  <Input type="url" placeholder="https://…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="address"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Adres *</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="Mahalle, sokak, no" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>İl *</FormLabel>
                <FormControl>
                  <Input placeholder="İstanbul" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="district"
            render={({ field }) => (
              <FormItem>
                <FormLabel>İlçe *</FormLabel>
                <FormControl>
                  <Input placeholder="Kadıköy" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Section>

      <Separator />

      <Section
        number="03"
        title="Yönetim"
        description="Üyelik ve durum bilgisi. Pasif dernekler varsayılan listede gösterilmez."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            name="memberCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Üye Sayısı</FormLabel>
                <FormControl>
                  <Input type="number" min={0} className="tabular-nums" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex items-start gap-3 space-y-0 rounded-md border border-border bg-background px-4 py-3 sm:col-span-2">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="flex-1">
                  <FormLabel className="text-[13px]">Aktif dernek</FormLabel>
                  <FormDescription className="text-[12px]">
                    Pasif konuma alınırsa listede filtrelenerek gizlenebilir.
                    Veriler silinmez.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>
      </Section>

      <Separator />

      <Section
        number="04"
        title="Görsel &amp; Notlar"
        description="Opsiyonel bilgi. Logo URL'si bir CDN bağlantısı olmalıdır."
      >
        <div className="space-y-5">
          <FormField
            name="logoUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Logo URL</FormLabel>
                <FormControl>
                  <LogoUploader value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notlar</FormLabel>
                <FormControl>
                  <Textarea
                    rows={5}
                    placeholder="İç notlar — üyelerle paylaşılmaz."
                    {...field}
                  />
                </FormControl>
                <FormDescription>En fazla 2000 karakter.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Section>
    </>
  );
}

function StepBaskan() {
  return (
    <Section
      number="05"
      title="Başkan"
      description="Dernek başkanına web hesabı açılır. Şifre ilk girişte kullanılır; başkan ardından kendi şifresini değiştirebilir."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          name="managerFullName"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Başkan Adı *</FormLabel>
              <FormControl>
                <Input placeholder="Mehmet Yılmaz" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="managerEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Başkan E-postası *</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="baskan@dernek.org"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Bu adresle Supabase hesabı açılır.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="managerPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefon</FormLabel>
              <FormControl>
                <Input placeholder="0555 444 55 66" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="managerPassword"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Geçici Şifre *</FormLabel>
              <FormControl>
                <PasswordField
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </Section>
  );
}

function StepOnizleme({ values }: { values: FormValues }) {
  const founded = useMemo(
    () =>
      values.foundedAt
        ? new Date(`${values.foundedAt}T00:00:00Z`).toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })
        : '—',
    [values.foundedAt],
  );

  return (
    <div className="px-6 py-7">
      <header className="mb-5 space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
          06
        </span>
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
          Önizleme
        </h2>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Bilgileri son kez kontrol edin. Kaydet'e basınca dernek ve başkan
          hesabı oluşturulur.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <PreviewCard title="Dernek">
          <PreviewRow label="Ad" value={values.name || '—'} />
          {values.shortName && (
            <PreviewRow label="Kısa Ad" value={values.shortName} />
          )}
          <PreviewRow
            label="Vergi No"
            value={
              <span className="font-mono">{values.taxNumber || '—'}</span>
            }
          />
          <PreviewRow label="Kuruluş" value={founded} />
          <PreviewRow label="Faaliyet" value={values.activityArea || '—'} />
          <PreviewRow
            label="Üye"
            value={
              <span className="tabular-nums">
                {Number(values.memberCount).toLocaleString('tr-TR')}
              </span>
            }
          />
          <PreviewRow
            label="Durum"
            value={values.isActive ? 'Aktif' : 'Pasif'}
          />
        </PreviewCard>

        <PreviewCard title="İletişim">
          <PreviewRow label="Telefon" value={values.phone || '—'} />
          <PreviewRow label="E-posta" value={values.email || '—'} />
          {values.website && (
            <PreviewRow label="Web" value={values.website} />
          )}
          <PreviewRow
            label="Adres"
            value={
              <span className="whitespace-pre-wrap">
                {values.address || '—'}
              </span>
            }
          />
          <PreviewRow
            label="Konum"
            value={`${values.city || '—'} / ${values.district || '—'}`}
          />
        </PreviewCard>

        <PreviewCard title="Başkan" className="sm:col-span-2">
          <PreviewRow label="Ad" value={values.managerFullName || '—'} />
          <PreviewRow label="E-posta" value={values.managerEmail || '—'} />
          {values.managerPhone && (
            <PreviewRow label="Telefon" value={values.managerPhone} />
          )}
          <PreviewRow
            label="Şifre"
            value={
              <span className="font-mono text-muted-foreground">
                {values.managerPassword
                  ? '•'.repeat(values.managerPassword.length)
                  : '—'}
              </span>
            }
          />
        </PreviewCard>
      </div>
    </div>
  );
}

function PreviewCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border bg-background',
        className,
      )}
    >
      <header className="border-b border-border px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
      </header>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-1.5 text-[13px] [&+&]:border-t [&+&]:border-border/60">
      <span className="text-[11.5px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function FormHeader({ step }: { step: StepNum }) {
  return (
    <header className="space-y-5 border-b border-border pb-6">
      <Breadcrumb
        items={[
          { href: '/associations', label: 'Dernek Sicili' },
          { label: 'Yeni Kayıt' },
        ]}
      />
      <div className="space-y-1.5">
        <span className="eyebrow">Yeni Kayıt</span>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          Dernek bilgilerini girin
        </h1>
        <p className="text-sm text-muted-foreground">
          Adımları sırayla tamamlayın. Önizlemeden sonra kayıt onaylanır.
        </p>
      </div>

      <Stepper current={step} />
    </header>
  );
}

function Stepper({ current }: { current: StepNum }) {
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-2">
      {STEPS.map((s, i) => {
        const state =
          s.n === current
            ? 'current'
            : s.n < current
              ? 'done'
              : 'upcoming';
        return (
          <li
            key={s.n}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn(
              'flex flex-1 items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
              state === 'current'
                ? 'border-primary/40 bg-primary/[0.04]'
                : state === 'done'
                  ? 'border-border bg-muted/30'
                  : 'border-dashed border-border/60 bg-background',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
                state === 'current'
                  ? 'bg-primary text-primary-foreground'
                  : state === 'done'
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {state === 'done' ? '✓' : s.n}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  'truncate text-[13px] font-semibold',
                  state === 'upcoming'
                    ? 'text-muted-foreground'
                    : 'text-foreground',
                )}
              >
                {s.title}
              </div>
              <div className="text-[11px] text-muted-foreground">{s.hint}</div>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight
                aria-hidden
                className="hidden h-4 w-4 text-muted-foreground/40 sm:block"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Breadcrumb({
  items,
}: {
  items: { href?: string; label: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-muted-foreground">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <div key={i} className="flex items-center gap-1">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{item.label}</span>
            )}
            {!isLast && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

function Section({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 px-6 py-7 lg:grid-cols-[220px_1fr]">
      <header className="space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
          {number}
        </span>
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </header>
      <div>{children}</div>
    </section>
  );
}

function StickyFooter({
  step,
  isPending,
  onPrev,
  onNext,
}: {
  step: StepNum;
  isPending: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const isFinal = step === 3;
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
        {step === 1 ? (
          <Button type="button" variant="ghost" asChild>
            <Link href="/associations">
              <ArrowLeft className="h-4 w-4" />
              Listeye dön
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={onPrev}>
            <ArrowLeft className="h-4 w-4" />
            Geri
          </Button>
        )}
        <div className="flex items-center gap-2">
          <span className="hidden text-[11.5px] uppercase tracking-widest text-muted-foreground sm:inline">
            Adım {step} / 3
          </span>
          {isFinal ? (
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Kaydediliyor…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Kaydet ve oluştur
                </>
              )}
            </Button>
          ) : (
            <Button type="button" onClick={onNext}>
              İleri
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
