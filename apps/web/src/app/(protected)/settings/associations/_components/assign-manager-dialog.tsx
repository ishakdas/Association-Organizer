'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftRight, Crown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  AdminAssociationResponse,
  MemberResponse,
} from '@ticketbot/shared-validation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { listMembers, transferManager } from '@/lib/api/members';

interface AssignManagerDialogProps {
  association: AdminAssociationResponse | null;
  onClose: () => void;
  onSuccess: () => void;
}

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Oturum süresi dolmuş');
  return token;
}

export function AssignManagerDialog({
  association,
  onClose,
  onSuccess,
}: AssignManagerDialogProps) {
  const open = association !== null;
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [toMembershipId, setToMembershipId] = useState('');
  const [demoteToRole, setDemoteToRole] = useState<
    'ASSOCIATION_SECRETARY' | 'ASSOCIATION_MEMBER'
  >('ASSOCIATION_MEMBER');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!association) return;
    let cancelled = false;
    setLoadingMembers(true);
    setMembers([]);
    setToMembershipId('');
    setDemoteToRole('ASSOCIATION_MEMBER');
    (async () => {
      try {
        const token = await getToken();
        const list = await listMembers(token, association.id, { isActive: true });
        if (!cancelled) setMembers(list);
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [association]);

  const currentManager =
    members.find((m) => m.role === 'ASSOCIATION_MANAGER') ?? null;
  const candidates = members.filter((m) => m.role !== 'ASSOCIATION_MANAGER');

  async function handleConfirm() {
    if (!association || !toMembershipId) {
      toast.error('Yeni başkanı seçin');
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      const updated = await transferManager(token, association.id, {
        toMembershipId,
        demoteToRole,
      });
      toast.success(
        `${updated.user.fullName} "${association.name}" derneğine başkan oldu`,
      );
      onSuccess();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Başkan ata / değiştir
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">
              &ldquo;{association?.name}&rdquo;
            </span>{' '}
            derneği için başkanı belirleyin. Seçilen üye başkan yapılır; mevcut
            başkan varsa tek adımda görevden alınır.
          </DialogDescription>
        </DialogHeader>

        {loadingMembers ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Üyeler yükleniyor…
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[13px]">
              <span className="text-muted-foreground">Mevcut başkan: </span>
              <span className="font-medium text-foreground">
                {currentManager ? currentManager.user.fullName : 'Atanmamış'}
              </span>
            </div>

            <div className="space-y-2">
              <Label>Yeni başkan *</Label>
              <Select value={toMembershipId} onValueChange={setToMembershipId}>
                <SelectTrigger>
                  <SelectValue placeholder="Üye seç" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Atanabilir üye yok
                    </div>
                  ) : (
                    candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.user.fullName}
                        {c.role === 'ASSOCIATION_SECRETARY' ? ' (Sekreter)' : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {currentManager && (
              <div className="space-y-2">
                <Label>Eski başkanın yeni rolü</Label>
                <Select
                  value={demoteToRole}
                  onValueChange={(v) =>
                    setDemoteToRole(
                      v as 'ASSOCIATION_SECRETARY' | 'ASSOCIATION_MEMBER',
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASSOCIATION_MEMBER">Üye</SelectItem>
                    <SelectItem value="ASSOCIATION_SECRETARY">Sekreter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {candidates.length === 0 && (
              <p className="text-[12.5px] text-muted-foreground">
                Bu dernekte başkan dışında üye yok. Önce derneğin Üyeler
                sekmesinden bir üye ekleyin.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={
              submitting ||
              loadingMembers ||
              candidates.length === 0 ||
              !toMembershipId
            }
          >
            {submitting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
            )}
            {currentManager ? 'Devret' : 'Ata'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
