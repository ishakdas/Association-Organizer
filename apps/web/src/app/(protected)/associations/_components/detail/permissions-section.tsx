'use client';

import { useState } from 'react';
import { Check, Loader2, Shield, X, MessageSquare, Wallet, ClipboardList, Users } from 'lucide-react';
import { usePermissions, useSyncPermissions, type PermissionAction } from '../../_hooks/use-permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const PERMISSIONS: { action: PermissionAction; label: string; icon: typeof MessageSquare; description: string }[] = [
  { action: 'USE_MEETING_COMMANDS', label: 'Toplantı Komutları', icon: MessageSquare, description: '/toplanti komutunu kullanabilir' },
  { action: 'USE_FINANCE_COMMANDS', label: 'Finans Komutları', icon: Wallet, description: '/finans, /gider, /bagis, /aidat, /kasa komutlarını kullanabilir' },
  { action: 'USE_TASK_COMMANDS', label: 'Görev Komutları', icon: ClipboardList, description: '/gorevlerim komutunu kullanabilir' },
  { action: 'VIEW_ALL_MEMBER_TASKS', label: 'Tüm Üye Görevleri', icon: Users, description: '/gorevlerim ile tüm üyelerin görevlerini listeleyebilir' },
];

const AVATAR_COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-indigo-500'];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface PermissionsSectionProps {
  associationId: string;
}

export function PermissionsSection({ associationId }: PermissionsSectionProps) {
  const { data: summaries, isLoading } = usePermissions(associationId);
  const syncMutation = useSyncPermissions(associationId);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionAction[]>([]);

  if (isLoading) return <PermissionsSkeleton />;

  if (!summaries || summaries.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">Henüz üye yok</h3>
          <p className="mt-2 text-sm text-muted-foreground">Üye ekledikten sonra yetki atayabilirsiniz.</p>
        </CardContent>
      </Card>
    );
  }

  function handleEdit(user: { userId: string; permissions: PermissionAction[] }) {
    setEditingUserId(user.userId);
    setSelectedPermissions([...user.permissions]);
  }

  function handleCancel() {
    setEditingUserId(null);
    setSelectedPermissions([]);
  }

  function handleSave(userId: string) {
    syncMutation.mutate({ userId, actions: selectedPermissions }, { onSuccess: () => { toast.success('Yetkiler güncellendi'); handleCancel(); } });
  }

  function togglePermission(action: PermissionAction) {
    setSelectedPermissions((prev) => prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]);
  }

  return (
    <div className="space-y-4">
      {summaries.map((user) => {
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
                    <Button variant="ghost" size="sm" onClick={handleCancel} disabled={syncMutation.isPending}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={() => handleSave(user.userId)} disabled={syncMutation.isPending}>
                      {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {syncMutation.isPending ? 'Kaydediliyor' : 'Kaydet'}
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>Düzenle</Button>
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
      })}
    </div>
  );
}

function PermissionsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
