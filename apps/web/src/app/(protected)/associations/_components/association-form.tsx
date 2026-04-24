'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateAssociation } from '../_hooks/use-create-association';
import { LogoUploader } from './logo-uploader';

// Form-local schema: native inputs produce strings, we re-validate on submit
// with the canonical server-facing schema (phone E.164 normalize etc.).
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
  presidentName: z.string().min(2).max(100),
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
      presidentName: '',
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Yeni Dernek</h1>
            <p className="text-sm text-muted-foreground">
              Sicile eklemek istediğiniz derneğin bilgilerini girin.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" asChild>
              <Link href="/associations">Vazgeç</Link>
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Kimlik</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Dernek Adı *</FormLabel>
                  <FormControl>
                    <Input placeholder="Örnek Derneği" {...field} />
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
                    <Input placeholder="ÖD" {...field} />
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
                    <Input placeholder="Eğitim, Sağlık, Sosyal Yardım..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>İletişim</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefon *</FormLabel>
                  <FormControl>
                    <Input placeholder="0555 111 22 33" {...field} />
                  </FormControl>
                  <FormDescription>Otomatik olarak +90 formatına çevrilir.</FormDescription>
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
                <FormItem>
                  <FormLabel>Web Sitesi</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://..." {...field} />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yönetim</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="presidentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Başkan *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ali Veli" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="memberCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Üye Sayısı</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0 rounded-md border border-border p-3 sm:col-span-2">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="flex-1">
                    <FormLabel>Aktif</FormLabel>
                    <FormDescription className="text-xs">
                      Pasif dernekler listede görünür ama filtreyle gizlenebilir.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logo & Notlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    <Textarea rows={4} placeholder="İç notlar..." {...field} />
                  </FormControl>
                  <FormDescription>En fazla 2000 karakter.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
