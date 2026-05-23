'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Loader2, Mail, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { approveBranchRegistration } from '@/lib/api/auth';

interface Props {
  registrationId: string;
  fullName: string;
  email: string;
  city: string;
  district: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved: () => void;
}

async function getToken() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

export function ApproveDialog({
  registrationId,
  fullName,
  email,
  city,
  district,
  open,
  onOpenChange,
  onApproved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ emailSent: boolean; magicLink: string | null } | null>(null);

  async function handleApprove() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await approveBranchRegistration(token, registrationId);
      setResult(res);
      toast.success('Şube onaylandı, davet e-postası gönderildi.');
      onApproved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Onay başarısız oldu.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setResult(null);
    onOpenChange(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Panoya kopyalandı');
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Şubeyi Onayla</DialogTitle>
          <DialogDescription>
            Aşağıdaki şube başvurusu onaylanacak. Onay verildiğinde şube sisteme eklenir
            ve başvuru sahibine davet e-postası gönderilir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Başvuran</p>
              <p className="mt-0.5 font-medium text-foreground">{fullName}</p>
              <p className="text-[13px] text-muted-foreground">{email}</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{city} / {district}</span>
            </div>
          </div>

          <p className="text-[12px] text-muted-foreground">
            Onay sonrası <strong>{city} - {district} Şubesi</strong> adıyla yeni bir şube oluşturulacak
            ve başvuran kişi şube başkanı olarak atanacaktır.
          </p>

          {result?.magicLink && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-700">
                Davet Linki (Yedek)
              </p>
              <p className="text-[13px] text-blue-800">
                E-posta ulaşmazsa bu linki kullanıcıya gönderebilirsiniz:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-[12px] text-blue-900">
                  {result.magicLink}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0"
                  onClick={() => copyToClipboard(result.magicLink!)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                İptal
              </Button>
              <Button onClick={handleApprove} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Onaylanıyor...
                  </>
                ) : (
                  <>
                    <Mail className="mr-1.5 h-4 w-4" />
                    Onayla ve Davet Gönder
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Kapat</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
