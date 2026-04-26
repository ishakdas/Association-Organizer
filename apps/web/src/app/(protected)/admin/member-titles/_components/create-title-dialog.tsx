'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import { z } from 'zod';
import { createMemberTitleSchema } from '@ticketbot/shared-validation';
import type { CreateMemberTitleInput } from '@ticketbot/shared-validation';
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
import { Switch } from '@/components/ui/switch';
import { useCreateTitle } from '../_hooks/use-admin-titles';

// Form-local schema mirrors the shared one but keeps types concrete
// (no `.default()` or `z.coerce.number()` divergence between input and
// output). We still validate against `createMemberTitleSchema` on submit.
const formSchema = z.object({
  name: z.string().min(2, 'En az 2 karakter').max(100),
  sortOrder: z.coerce.number().int().nonnegative(),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

const FORM_DEFAULTS: FormValues = {
  name: '',
  sortOrder: 0,
  isActive: true,
};

export function CreateTitleDialog() {
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: FORM_DEFAULTS,
  });

  const mutation = useCreateTitle({
    onSuccess: () => {
      form.reset(FORM_DEFAULTS);
      setOpen(false);
    },
  });

  function onSubmit(values: FormValues) {
    const payload: CreateMemberTitleInput = {
      name: values.name,
      sortOrder: values.sortOrder,
      isActive: values.isActive,
    };
    mutation.mutate(payload);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset(FORM_DEFAULTS);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Yeni Unvan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Yeni unvan ekle</DialogTitle>
          <DialogDescription>
            Slug isimden otomatik türetilir. Aynı ada sahip unvan olursa
            sonuna sayaç eklenir.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>İsim *</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn. Denetleme Kurulu Başkanı" autoFocus {...field} />
                  </FormControl>
                  <FormDescription>2–100 karakter.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sortOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sıralama</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      className="tabular-nums"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Küçük sayılar listede üstte gösterilir.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-start gap-3 space-y-0 rounded-md border border-border bg-background px-4 py-3">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="flex-1">
                    <FormLabel className="text-[13px]">Aktif</FormLabel>
                    <FormDescription className="text-[12px]">
                      Kapalı olursa üye ekleme ekranında görünmez.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

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
