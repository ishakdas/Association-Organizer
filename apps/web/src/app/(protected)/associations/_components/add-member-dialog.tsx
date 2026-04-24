'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addMemberSchema } from '@ticketbot/shared-validation';
import { UserPlus, Loader2 } from 'lucide-react';
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

const roleOptions = [
  { value: 'ASSOCIATION_MANAGER' as const, label: 'Başkan (yönetici)' },
  { value: 'ASSOCIATION_SECRETARY' as const, label: 'Sekreter' },
  { value: 'ASSOCIATION_MEMBER' as const, label: 'Üye' },
];

// Form-local schema: native inputs are strings.
const formSchema = z.object({
  fullName: z.string().min(2, 'En az 2 karakter').max(200),
  email: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum([
    'ASSOCIATION_MANAGER',
    'ASSOCIATION_SECRETARY',
    'ASSOCIATION_MEMBER',
  ]),
  titleId: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function AddMemberDialog({ associationId }: { associationId: string }) {
  const [open, setOpen] = useState(false);
  const { data: titles } = useTitles();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      role: 'ASSOCIATION_MEMBER',
      titleId: NO_TITLE,
    },
  });

  const mutation = useAddMember(associationId, {
    onSuccess: () => {
      form.reset();
      setOpen(false);
    },
  });

  function onSubmit(values: FormValues) {
    const parsed = addMemberSchema.safeParse({
      ...values,
      email: values.email || undefined,
      phone: values.phone || undefined,
      titleId:
        values.titleId && values.titleId !== NO_TITLE
          ? values.titleId
          : undefined,
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          Üye Ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Yeni üye</DialogTitle>
          <DialogDescription>
            Derneğe yeni bir kişi ekleyin. E-posta ve telefon opsiyoneldir.
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

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roleOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Bir dernekte aynı anda yalnızca <b>tek başkan</b> olabilir.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Örn. Teşkilat Başkanı, Kadın Kolları Başkanı.
                  </FormDescription>
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
                      <Input type="email" placeholder="ali@..." {...field} />
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
                      <Input placeholder="0555 111 22 33" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
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
                  'Ekle'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
