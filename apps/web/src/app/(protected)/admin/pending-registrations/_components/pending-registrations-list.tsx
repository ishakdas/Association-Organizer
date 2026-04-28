'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, Phone, MessageSquare, X, RefreshCw, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import {
  listPendingRegistrations,
  listApprovedRegistrations,
  rejectBranchRegistration,
  resendInvite,
  type PendingRegistration,
} from '@/lib/api/auth';
import { ApproveDialog } from './approve-dialog';

async function getToken() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

const PENDING_KEY = ['pending-registrations'] as const;
const APPROVED_KEY = ['approved-registrations'] as const;

type Tab = 'pending' | 'approved';

export function PendingRegistrationsList({
  initialData,
}: {
  initialData: PendingRegistration[];
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('pending');
  const [approveTarget, setApproveTarget] = useState<PendingRegistration | null>(null);

  const { data: pendingData, isFetching, refetch } = useQuery({
    queryKey: PENDING_KEY,
    queryFn: async () => listPendingRegistrations(await getToken()),
    initialData,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const { data: approvedData } = useQuery({
    queryKey: APPROVED_KEY,
    queryFn: async () => listApprovedRegistrations(await getToken()),
    enabled: tab === 'approved',
  });

  async function handleReject(id: string) {
    if (!confirm('Bu başvuruyu reddetmek istediğinize emin misiniz?')) return;
    try {
      const token = await getToken();
      await rejectBranchRegistration(token, id);
      toast.success('Başvuru reddedildi.');
      queryClient.invalidateQueries({ queryKey: PENDING_KEY });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'İşlem başarısız.');
    }
  }

  async function handleResend(id: string) {
    try {
      const token = await getToken();
      await resendInvite(token, id);
      toast.success('Davet e-postası yeniden gönderildi.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gönderim başarısız.');
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
      <div className="flex rounded-lg border border-border bg-muted p-1 w-fit">
        <button
          onClick={() => setTab('pending')}
          className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'pending'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Bekleyen
          {pendingData.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
              {pendingData.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('approved')}
          className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'approved'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Onaylandı
        </button>
      </div>
      <button
        onClick={() => refetch()}
        disabled={isFetching}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 transition-colors"
        title="Yenile"
      >
        <RotateCcw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        Yenile
      </button>
      </div>

      {tab === 'pending' && (
        <>
          {pendingData.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 py-16 text-center">
              <Clock className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Bekleyen başvuru yok</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Yeni şube başvuruları burada görünecek.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingData.map((reg) => (
                <RegistrationCard
                  key={reg.id}
                  registration={reg}
                  onApprove={() => setApproveTarget(reg)}
                  onReject={() => handleReject(reg.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'approved' && (
        <>
          {!approvedData || approvedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 py-16 text-center">
              <CheckCircle2 className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Onaylanmış başvuru yok</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Onaylanan başvurular burada görünecek.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvedData.map((reg) => (
                <ApprovedCard
                  key={reg.id}
                  registration={reg}
                  onResend={() => handleResend(reg.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {approveTarget && (
        <ApproveDialog
          registrationId={approveTarget.id}
          fullName={approveTarget.fullName}
          email={approveTarget.email}
          open={true}
          onOpenChange={(open) => { if (!open) setApproveTarget(null); }}
          onApproved={() => {
            setApproveTarget(null);
            queryClient.invalidateQueries({ queryKey: PENDING_KEY });
            queryClient.invalidateQueries({ queryKey: APPROVED_KEY });
          }}
        />
      )}
    </>
  );
}

function RegistrationCard({
  registration,
  onApprove,
  onReject,
}: {
  registration: PendingRegistration;
  onApprove: () => void;
  onReject: () => void;
}) {
  const date = new Date(registration.createdAt).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div>
            <p className="font-semibold text-foreground">{registration.fullName}</p>
            <p className="text-[13px] text-muted-foreground">{registration.email}</p>
          </div>

          <div className="flex flex-wrap gap-3 text-[12px] text-muted-foreground">
            {registration.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {registration.phone}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {date}
            </span>
          </div>

          {registration.message && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{registration.message}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={onApprove}>
            Onayla
          </Button>
          <Button size="sm" variant="outline" onClick={onReject}>
            <X className="h-3.5 w-3.5" />
            Reddet
          </Button>
        </div>
      </div>
    </div>
  );
}

function ApprovedCard({
  registration,
  onResend,
}: {
  registration: PendingRegistration;
  onResend: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const approvedDate = registration.createdAt
    ? new Date(registration.createdAt).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  async function handleResend() {
    setLoading(true);
    try {
      await onResend();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <div>
              <p className="font-semibold text-foreground">{registration.fullName}</p>
              <p className="text-[13px] text-muted-foreground">{registration.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-[12px] text-muted-foreground">
            {registration.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {registration.phone}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {approvedDate}
            </span>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleResend}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Yeniden Gönder
        </Button>
      </div>
    </div>
  );
}
