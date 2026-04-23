'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Users } from 'lucide-react';
import {
  createOrganisationSchema,
  type CreateOrganisationInput,
} from '@ticketbot/shared-validation';
import { createClient } from '@/lib/supabase/client';
import {
  createOrganisation,
  getMyOrganisations,
  type MembershipWithOrganisation,
} from '@/lib/api/organisations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const ORGS_QUERY_KEY = ['organisations', 'mine'] as const;

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Oturum süresi dolmuş');
  return token;
}

export function OrganisationsView({
  initialData,
}: {
  initialData: MembershipWithOrganisation[];
}) {
  const [open, setOpen] = useState(false);

  const { data: memberships = [] } = useQuery({
    queryKey: ORGS_QUERY_KEY,
    queryFn: async () => getMyOrganisations(await getAccessToken()),
    initialData,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dernekler</h1>
          <p className="text-sm text-muted-foreground">
            Üyesi olduğunuz dernekler ve rolleriniz.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Yeni Dernek
            </Button>
          </DialogTrigger>
          <CreateOrganisationDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      {memberships.length === 0 ? (
        <EmptyState onCreate={() => setOpen(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map((m) => (
            <OrganisationCard key={m.id} membership={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrganisationCard({ membership }: { membership: MembershipWithOrganisation }) {
  const { organisation, role } = membership;
  return (
    <Link href={`/organisation/${organisation.id}`} className="block">
      <Card className="transition-colors hover:border-foreground/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="truncate">{organisation.name}</span>
            <RoleBadge role={role} />
          </CardTitle>
          <CardDescription>@{organisation.slug}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            Üyelik tarihi: {new Date(membership.createdAt).toLocaleDateString('tr-TR')}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

function RoleBadge({ role }: { role: string }) {
  const label: Record<string, string> = {
    SUPER_ADMIN: 'Süper Yönetici',
    ADMIN: 'Yönetici',
    MANAGER: 'Sorumlu',
    MEMBER: 'Üye',
  };
  const tone: Record<string, string> = {
    SUPER_ADMIN: 'bg-primary text-primary-foreground',
    ADMIN: 'bg-primary/90 text-primary-foreground',
    MANAGER: 'bg-secondary text-secondary-foreground',
    MEMBER: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${tone[role] ?? ''}`}>
      {label[role] ?? role}
    </span>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Users className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <h3 className="text-base font-medium">Henüz bir derneğe üye değilsiniz</h3>
          <p className="text-sm text-muted-foreground">
            Kendi derneğinizi oluşturun veya yönetici sizi davet etsin.
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Yeni Dernek Oluştur
        </Button>
      </CardContent>
    </Card>
  );
}

function CreateOrganisationDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<CreateOrganisationInput>({
    resolver: zodResolver(createOrganisationSchema),
    defaultValues: { name: '', slug: '' },
  });

  const mutation = useMutation({
    mutationFn: async (input: CreateOrganisationInput) =>
      createOrganisation(await getAccessToken(), input),
    onSuccess: (org) => {
      toast.success(`"${org.name}" oluşturuldu`);
      queryClient.invalidateQueries({ queryKey: ORGS_QUERY_KEY });
      form.reset();
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Yeni Dernek Oluştur</DialogTitle>
        <DialogDescription>
          Dernek oluşturulduğunda otomatik olarak Yönetici rolüyle üye olursunuz.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dernek Adı</FormLabel>
                <FormControl>
                  <Input placeholder="Örnek Derneği" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input placeholder="ornek-dernegi" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
