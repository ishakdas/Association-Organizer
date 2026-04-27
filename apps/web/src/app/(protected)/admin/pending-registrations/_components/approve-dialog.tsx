'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { approveBranchRegistration } from '@/lib/api/auth';
import { listAssociations } from '@/lib/api/associations';
import { useQuery } from '@tanstack/react-query';

interface Props {
  registrationId: string;
  fullName: string;
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved: () => void;
}

async function getToken() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

const ROLE_OPTIONS = [
  { value: 'ASSOCIATION_MANAGER', label: 'Başkan' },
  { value: 'ASSOCIATION_SECRETARY', label: 'Sekreter' },
  { value: 'ASSOCIATION_MEMBER', label: 'Üye' },
];

export function ApproveDialog({
  registrationId,
  fullName,
  email,
  open,
  onOpenChange,
  onApproved,
}: Props) {
  const [associationId, setAssociationId] = useState('');
  const [role, setRole] = useState('ASSOCIATION_MEMBER');
  const [loading, setLoading] = useState(false);

  const { data: associations } = useQuery({
    queryKey: ['associations-all'],
    queryFn: async () => listAssociations(await getToken(), { page: 1, pageSize: 100 }),
    enabled: open,
  });

  async function handleApprove() {
    if (!associationId) {
      toast.error('Lütfen bir dernek seçin.');
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      await approveBranchRegistration(token, registrationId, { associationId, role });
      toast.success('Davet e-postası gönderildi.');
      onApproved();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Onay başarısız oldu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Başvuruyu Onayla</DialogTitle>
          <DialogDescription>
            <strong>{fullName}</strong> ({email}) adına davet e-postası gönderilecek.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium">Dernek</Label>
            <Select value={associationId} onValueChange={setAssociationId}>
              <SelectTrigger>
                <SelectValue placeholder="Dernek seçin..." />
              </SelectTrigger>
              <SelectContent>
                {associations?.data.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium">Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            İptal
          </Button>
          <Button onClick={handleApprove} disabled={loading || !associationId}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              'Onayla ve Davet Gönder'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
