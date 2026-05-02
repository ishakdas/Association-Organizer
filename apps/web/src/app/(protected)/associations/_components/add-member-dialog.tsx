'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { MembershipRole } from '@ticketbot/shared-validation';
import { Loader2, UserPlus } from 'lucide-react';
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
import { useAddMember } from '../_hooks/use-members';
import { useTitles } from '../_hooks/use-titles';

const NO_TITLE = '__none__';
const CUSTOM_TITLE = '__custom__';

const formSchema = z
  .object({
    fullName: z.string().min(2, 'En az 2 karakter').max(200),
    email: z.string().email('Geçerli e-posta').optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().max(500).optional(),
    titleId: z.string().optional(),
    customTitle: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.titleId === CUSTOM_TITLE) {
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
  const { data: titles } = useTitles();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      address: '',
      titleId: NO_TITLE,
      customTitle: '',
    },
  });

  const titleId = form.watch('titleId');

  const mutation = useAddMember(associationId, {
    onSuccess: () => {
      form.reset();
      setOpen(false);
    },
  });

  function onSubmit(values: FormValues) {
    const useCustom = values.titleId === CUSTOM_TITLE;
    const titleIdValue =
      values.titleId && values.titleId !== NO_TITLE && values.titleId !== CUSTOM_TITLE
        ? values.titleId
        : undefined;

    mutation.mutate({
      fullName: values.fullName,
      email: values.email || undefined,
      phone: values.phone || undefined,
      address: values.address || undefined,
      role: defaultRole === 'ASSOCIATION_MANAGER' ? 'ASSOCIATION_MANAGER' : 'ASSOCIATION_MEMBER',
      titleId: titleIdValue,
      customTitle: useCustom ? values.customTitle?.trim() : undefined,
    });
  }

  const showTitleFields = defaultRole !== 'ASSOCIATION_MANAGER';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {defaultRole === 'ASSOCIATION_MANAGER' ? 'Başkan Ata' : 'Üye Ekle'}
          </DialogTitle>
          <DialogDescription>
            Kişi bilgilerini girin. Üye olarak kaydedilir; giriş hesabı oluşturulmaz.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    <FormLabel>E-posta</FormLabel>
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
                ) : (
                  defaultRole === 'ASSOCIATION_MANAGER' ? 'Başkan Olarak Ata' : 'Üye Olarak Ekle'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
