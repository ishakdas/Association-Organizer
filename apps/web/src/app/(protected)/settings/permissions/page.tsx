'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { getAccessToken } from '@/app/(protected)/associations/_hooks/use-associations';
import { getMe } from '@/lib/api/me';
import { activeMemberships } from '@/lib/permissions';
import { listPermissions, grantPermission, revokePermission } from '@/lib/api/finance';
import { listMembers } from '@/lib/api/members';

interface Permission {
  id: string;
  user: { id: string; fullName: string };
  grantedAt: string;
  isActive: boolean;
}

interface Member {
  id: string;
  user: { id: string; fullName: string };
  role: string;
}

export default function PermissionsSettingsPage() {
  const [associationId, setAssociationId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getAccessToken();
        const me = await getMe(token);
        const active = activeMemberships(me);
        if (active.length === 0) {
          setLoading(false);
          return;
        }
        const assocId = active[0].associationId;
        setAssociationId(assocId);

        const [perms, mems] = await Promise.all([
          listPermissions(token, assocId),
          listMembers(token, assocId),
        ]);
        setPermissions(perms);
        setMembers(mems);
      } catch (err) {
        console.error(err);
        toast.error('Veriler yüklenemedi');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const availableMembers = members.filter(
    (m) => !permissions.some((p) => p.user.id === m.user.id && p.isActive),
  );

  async function handleGrant() {
    if (!associationId || !selectedMemberId) {
      toast.error('Üye seçin');
      return;
    }
    setGranting(true);
    try {
      const token = await getAccessToken();
      await grantPermission(token, associationId, { userId: selectedMemberId });
      toast.success('Yetki verildi');
      setSelectedMemberId('');
      const perms = await listPermissions(token, associationId);
      setPermissions(perms);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yetki verilemedi');
    } finally {
      setGranting(false);
    }
  }

  async function handleRevoke(userId: string) {
    if (!associationId) return;
    setRevokingId(userId);
    try {
      const token = await getAccessToken();
      await revokePermission(token, associationId, userId);
      toast.success('Yetki alındı');
      const perms = await listPermissions(token, associationId);
      setPermissions(perms);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yetki alınamadı');
    } finally {
      setRevokingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8 pb-10">
        <PageHeader />
        <div className="h-40 animate-pulse rounded-xl border border-border bg-muted" />
      </div>
    );
  }

  if (!associationId) {
    return (
      <div className="space-y-8 pb-10">
        <PageHeader />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Finans yetkilerini yönetmek için bir dernek seçmelisiniz.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <PageHeader />

      <Card>
        <CardHeader>
          <CardTitle>Finans Yetkisi Ver</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Üye seçin" />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.map((m) => (
                  <SelectItem key={m.user.id} value={m.user.id}>
                    {m.user.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleGrant} disabled={granting || !selectedMemberId}>
              <Users className="mr-2 h-4 w-4" />
              Yetki Ver
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yetkili Kullanıcılar</CardTitle>
        </CardHeader>
        <CardContent>
          {permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz finans yetkisi verilmemiş.</p>
          ) : (
            <div className="divide-y">
              {permissions.map((perm) => (
                <div key={perm.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{perm.user.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(perm.grantedAt).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(perm.user.id)}
                    disabled={revokingId === perm.user.id}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Yetkiyi Al
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PageHeader() {
  return (
    <header className="space-y-5 border-b border-border pb-6">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1 text-[12px] text-muted-foreground"
      >
        <Link
          href="/settings"
          className="font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Ayarlar
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        <span className="font-medium text-foreground">Yetki</span>
      </nav>
      <div className="space-y-1.5">
        <span className="eyebrow">Yönetim</span>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          Yetki
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Dernek finans işlemleri için yetki verme ve yetki alma işlemlerini buradan yönetin.
        </p>
      </div>
    </header>
  );
}
