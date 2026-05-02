'use client';

import { useEffect, useState } from 'react';
import { Mail, MapPin, Phone, RefreshCw, User, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { getAssociation } from '@/lib/api/associations';
import { listMembers } from '@/lib/api/members';
import { resendInviteForUser } from '@/lib/api/auth';
import type { AssociationDto } from '@ticketbot/shared-types';
import type { MemberResponse } from '@ticketbot/shared-validation';
import Link from 'next/link';

interface BranchDetailModalProps {
  associationId: string | null;
  onClose: () => void;
}

export function BranchDetailModal({ associationId, onClose }: BranchDetailModalProps) {
  const [branch, setBranch] = useState<AssociationDto | null>(null);
  const [manager, setManager] = useState<MemberResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!associationId) return;

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(false);
      setBranch(null);
      setManager(null);

      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const [branchData, members] = await Promise.all([
          getAssociation(session.access_token, associationId!),
          listMembers(session.access_token, associationId!, {
            role: 'ASSOCIATION_MANAGER',
            isActive: true,
          }),
        ]);

        if (!cancelled) {
          setBranch(branchData);
          setManager(members[0] ?? null);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [associationId]);

  async function handleResendInvite() {
    if (!manager) return;
    setResending(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Oturum süresi dolmuş');
      await resendInviteForUser(session.access_token, manager.user.id);
      toast.success('Davet e-postası yeniden gönderildi.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gönderim başarısız.');
    } finally {
      setResending(false);
    }
  }

  if (!associationId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:w-full">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            Şube bilgileri yüklenemedi.
            <Button variant="ghost" size="sm" className="mt-3 block mx-auto" onClick={onClose}>
              Kapat
            </Button>
          </div>
        )}

        {!loading && !error && branch && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
              <div className="space-y-1">
                <Badge variant={branch.isActive ? 'success' : 'outline'} className="mb-1">
                  {branch.isActive ? 'Aktif' : 'Pasif'}
                </Badge>
                <h2 className="text-[17px] font-bold leading-tight text-foreground">
                  {branch.name}
                </h2>
                <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {branch.city} / {branch.district}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Kapat"
                className="mt-0.5 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stats mini-grid */}
            <div className="grid grid-cols-2 gap-px border-b border-border bg-border">
              <div className="bg-card px-6 py-4">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Aktif Üye
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {branch.memberCount.toLocaleString('tr-TR')}
                </div>
              </div>
              <div className="bg-card px-6 py-4">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Durum
                </div>
                <div className={`mt-1 text-[15px] font-semibold ${branch.isActive ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
                  {branch.isActive ? 'Aktif' : 'Pasif'}
                </div>
              </div>
            </div>

            {/* İletişim */}
            <div className="border-b border-border px-6 py-4">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                İletişim
              </p>
              <div className="space-y-2">
                <InfoRow icon={<Mail className="h-3.5 w-3.5" />}>
                  <a href={`mailto:${branch.email}`} className="hover:underline">
                    {branch.email}
                  </a>
                </InfoRow>
                {branch.phone && (
                  <InfoRow icon={<Phone className="h-3.5 w-3.5" />}>
                    {branch.phone}
                  </InfoRow>
                )}
              </div>
            </div>

            {/* Başkan */}
            <div className="px-6 py-4">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Başkan
              </p>
              {manager ? (
                <div className="space-y-2">
                  <InfoRow icon={<User className="h-3.5 w-3.5" />}>
                    <span className="font-medium">{manager.user.fullName}</span>
                  </InfoRow>
                  {manager.user.email && (
                    <InfoRow icon={<Mail className="h-3.5 w-3.5" />}>
                      <a href={`mailto:${manager.user.email}`} className="hover:underline">
                        {manager.user.email}
                      </a>
                    </InfoRow>
                  )}
                  {manager.user.phone && (
                    <InfoRow icon={<Phone className="h-3.5 w-3.5" />}>
                      {manager.user.phone}
                    </InfoRow>
                  )}
                  {manager.user.mustChangePassword && (
                    <div className="pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleResendInvite}
                        disabled={resending}
                        className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
                        {resending ? 'Gönderiliyor…' : 'Link gönder'}
                      </Button>
                      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                        Şifre henüz belirlenmemiş
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">Başkan bulunamadı</p>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4">
              <Button asChild className="w-full">
                <Link href={`/associations/${branch.id}`}>
                  Şubeye Git
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function InfoRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-foreground">
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </div>
  );
}
