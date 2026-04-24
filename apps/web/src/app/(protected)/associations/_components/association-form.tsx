'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Loader2, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { useCreateAssociation } from '../_hooks/use-create-association';
import { LogoUploader } from './logo-uploader';

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
});

type FormValues = z.infer<typeof formSchema>;

export function AssociationForm() {
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
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
    },
  });

  const mutation = useCreateAssociation({
    onSuccess: (id) => router.push(`/associations/${id}`),
  });

  function onSubmit(values: FormValues) {
    const foundedAtIso = new Date(`${values.foundedAt}T00:00:00Z`).toISOString();

    const parsed = createAssociationSchema.safeParse({
      ...values,
      foundedAt: foundedAtIso,
      website: values.website || undefined,
      logoUrl: values.logoUrl || undefined,
      notes: values.notes || undefined,
      shortName: values.shortName || undefined,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === 'string') {
          form.setError(path as keyof FormValues, { message: issue.message });
        }
      }
      return;
    }

    mutation.mutate(parsed.data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="pb-28">
        <div className="space-y-8">
          <FormHeader />

          <div className="rounded-lg border border-border bg-card">
            <Section
              number="01"
              title="Kimlik"
              description="Dernek tüzel kişilik bilgileri. Bunlar sicile tek kez girilir."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
          </div>
        </div>

        <StickyFooter isPending={mutation.isPending} />
      </form>
    </Form>
  );
}

function FormHeader() {
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
          Zorunlu alanlar{' '}
          <span className="text-foreground">*</span> ile işaretlidir. Kaydettikten
          sonra detaylar düzenlenebilir.
        </p>
      </div>
    </header>
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

function StickyFooter({ isPending }: { isPending: boolean }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <Button type="button" variant="ghost" asChild>
          <Link href="/associations">
            <ArrowLeft className="h-4 w-4" />
            Listeye dön
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/associations">Vazgeç</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Kaydediliyor…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Kaydet
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
