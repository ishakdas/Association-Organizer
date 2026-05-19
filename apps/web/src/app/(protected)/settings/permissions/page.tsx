'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Shield, Check, X, Loader2, MessageSquare, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { getAccessToken } from '@/app/(protected)/associations/_hooks/use-associations';
import { getMe } from '@/lib/api/me';
import { activeMemberships } from '@/lib/permissions';
import { getPermissions, syncPermissions, type PermissionAction, type UserPermissionSummary } from '@/lib/api/permissions';

const PERMISSIONS: { action: PermissionAction; label: string; icon: typeof MessageSquare; description: string }[] = [
  { action: 'USE_MEETING_COMMANDS', label: 'Toplantı Komutları', icon: MessageSquare, description: '/toplanti komutunu kullanabilir' },
  { action: 'USE_FINANCE_COMMANDS', label: 'Finans Komutları', icon: Wallet, description: '/finans, /gider, /bagis, /aidat, /kasa komutlarını kullanabilir' },
];

const AVATAR_COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-indigo-500'];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function PermissionsSettingsPage() {
  const [associationId, setAssociationId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<UserPermissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionAction[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const token = await getAccessToken();
        const me = await getMe(token);
        const active = activeMemberships(me);
        if (active.length === 0) { setLoading(false); return; }
        const assocId = active[0].associationId;
        setAssociationId(assocId);
        const perms = await getPermissions(token, assocId);
        setSummaries(perms);
      } catch (err) {
        console.error(err);
        toast.error('Veriler yüklenemedi');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!associationId || !editingUserId) return;
    setSaving(true);
    try {
      const token = await getAccessToken();
      await syncPermissions(token, associationId, editingUserId, selectedPermissions);
      toast.success('Yetkiler güncellendi');
      setEditingUserId(null);
      setSelectedPermissions([]);
      const perms = await getPermissions(token, associationId);
      setSummaries(perms);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yetkiler güncellenemedi');
    } finally {
      setSaving(false);
    }
  }

  function togglePermission(action: PermissionAction) {
    setSelectedPermissions((prev) => prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]);
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
            <p className="text-sm text-muted-foreground">Yetkileri yönetmek için bir dernek seçmelisiniz.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <PageHeader />

      <div className="space-y-4">
        {summaries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-4 text-lg font-medium text-foreground">Henüz yetki atanmamış</h3>
              <p className="mt-2 text-sm text-muted-foreground">Üye ekledikten sonra yetki atayabilirsiniz.</p>
            </CardContent>
          </Card>
        ) : (
          summaries.map((user) => {
            const isEditing = editingUserId === user.userId;
            return (
              <Card key={user.userId} className={`transition-all duration-200 ${isEditing ? 'ring-2 ring-primary/30 shadow-lg' : 'hover:shadow-md'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ${getAvatarColor(user.fullName)}`}>
                        {user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-base">{user.fullName}</CardTitle>
                        {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingUserId(null); setSelectedPermissions([]); }} disabled={saving}>
                          <X className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={saving}>
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          {saving ? 'Kaydediliyor' : 'Kaydet'}
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => { setEditingUserId(user.userId); setSelectedPermissions([...user.permissions]); }}>
                        Düzenle
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!isEditing ? (
                    <div className="flex flex-wrap gap-1.5">
                      {user.permissions.length === 0 ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Yetki yok</Badge>
                      ) : (
                        user.permissions.map((action) => {
                          const perm = PERMISSIONS.find((p) => p.action === action);
                          return (
                            <Badge key={action} className="text-xs bg-amber-500/10 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400">
                              {perm?.label ?? action}
                            </Badge>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {PERMISSIONS.map((perm) => (
                        <label key={perm.action} className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 cursor-pointer select-none hover:bg-muted/50 transition-colors">
                          <Checkbox
                            checked={selectedPermissions.includes(perm.action)}
                            onCheckedChange={() => togglePermission(perm.action)}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <perm.icon className="h-4 w-4 text-foreground" />
                              <span className="text-sm font-medium text-foreground">{perm.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <header className="space-y-5 border-b border-border pb-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-muted-foreground">
        <Link href="/settings" className="font-medium text-muted-foreground transition-colors hover:text-foreground">
          Ayarlar
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        <span className="font-medium text-foreground">Yetki</span>
      </nav>
      <div className="space-y-1.5">
        <span className="eyebrow">Yönetim</span>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          Yetki Yönetimi
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Üyelerin Telegram üzerinden hangi komutları kullanabileceğini buradan yönetin.
        </p>
      </div>
    </header>
  );
}
