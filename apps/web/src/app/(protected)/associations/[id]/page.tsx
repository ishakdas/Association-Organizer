import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Hash,
  Mail,
  MapPin,
  Phone,
  User as UserIcon,
  Users,
  Globe,
} from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { getAssociation } from '@/lib/api/associations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AssociationDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) notFound();

  try {
    const association = await getAssociation(session.access_token, id);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/associations">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Geri
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {association.name}
                </h1>
                <Badge variant={association.isActive ? 'default' : 'secondary'}>
                  {association.isActive ? 'Aktif' : 'Pasif'}
                </Badge>
              </div>
              {association.shortName && (
                <p className="text-sm text-muted-foreground">{association.shortName}</p>
              )}
            </div>
          </div>
          {association.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={association.logoUrl}
              alt=""
              className="h-16 w-16 rounded-md border border-border object-contain"
            />
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" /> Kimlik
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field icon={<Hash className="h-3.5 w-3.5" />} label="VKN" mono>
                {association.taxNumber}
              </Field>
              <Field icon={<Calendar className="h-3.5 w-3.5" />} label="Kuruluş">
                {new Date(association.foundedAt).toLocaleDateString('tr-TR')}
              </Field>
              <Field label="Faaliyet Alanı">{association.activityArea}</Field>
              <Field icon={<UserIcon className="h-3.5 w-3.5" />} label="Başkan">
                {association.presidentName}
              </Field>
              <Field icon={<Users className="h-3.5 w-3.5" />} label="Üye Sayısı">
                {association.memberCount}
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4" /> İletişim
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field icon={<Phone className="h-3.5 w-3.5" />} label="Telefon">
                {association.phone}
              </Field>
              <Field icon={<Mail className="h-3.5 w-3.5" />} label="E-posta">
                <a href={`mailto:${association.email}`} className="hover:underline">
                  {association.email}
                </a>
              </Field>
              {association.website && (
                <Field icon={<Globe className="h-3.5 w-3.5" />} label="Web">
                  <a
                    href={association.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:underline"
                  >
                    {association.website}
                  </a>
                </Field>
              )}
              <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Şehir">
                {association.city} / {association.district}
              </Field>
              <Field label="Adres">{association.address}</Field>
            </CardContent>
          </Card>
        </div>

        {association.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notlar</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
              {association.notes}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          Son güncelleme: {new Date(association.updatedAt).toLocaleString('tr-TR')}
        </p>
      </div>
    );
  } catch {
    notFound();
  }
}

function Field({
  icon,
  label,
  children,
  mono,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={mono ? 'font-mono text-xs' : ''}>{children}</span>
    </div>
  );
}
