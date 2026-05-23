'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, CheckCircle2, XCircle, Loader2, Calendar, Bell } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUnpaidMembers, useBulkFeePayment, useFinanceSettings } from '../../../_hooks/use-finance';

function kurusToTl(kurus: number): string {
  return `${(kurus / 100).toFixed(2)} TL`;
}

interface Props {
  associationId: string;
}

export function BulkFeeCollection({ associationId }: Props) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

  const { data: unpaidMembers, isLoading: loadingMembers } = useUnpaidMembers(associationId, selectedMonth);
  const { data: settings } = useFinanceSettings(associationId);
  const bulkMutation = useBulkFeePayment(associationId);

  const defaultAmount = settings?.monthlyFeeAmountKurus ?? 0;

  const members = useMemo(() => {
    if (!unpaidMembers) return [];
    return unpaidMembers.map((m) => ({
      ...m,
      amount: defaultAmount,
    }));
  }, [unpaidMembers, defaultAmount]);

  const selectedCount = selectedMembers.size;
  const totalAmount = members
    .filter((m) => selectedMembers.has(m.membershipId))
    .reduce((sum, m) => sum + m.amount, 0);

  const handleToggleMember = (membershipId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(membershipId)) {
        next.delete(membershipId);
      } else {
        next.add(membershipId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedCount === members.filter((m) => !m.hasPaid).length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(
        new Set(members.filter((m) => !m.hasPaid).map((m) => m.membershipId)),
      );
    }
  };

  const handleCollect = () => {
    if (selectedCount === 0) return;

    const payments = members
      .filter((m) => selectedMembers.has(m.membershipId))
      .map((m) => ({
        membershipId: m.membershipId,
        amountInKurus: m.amount,
        month: selectedMonth,
      }));

    bulkMutation.mutate(
      { payments },
      {
        onSuccess: () => {
          setSelectedMembers(new Set());
        },
      },
    );
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value && /^\d{4}-\d{2}$/.test(value)) {
      setSelectedMonth(value);
      setSelectedMembers(new Set());
    }
  };

  if (loadingMembers) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!members.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-primary" />
            Toplu Aidat Tahsilat
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Aktif üye bulunamadı.
        </CardContent>
      </Card>
    );
  }

  const paidCount = members.filter((m) => m.hasPaid).length;
  const unpaidCount = members.length - paidCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Toplu Aidat Tahsilat
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              className="h-7 w-[140px] text-xs"
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-emerald-50 p-3"
          >
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">Ödedi</span>
            </div>
            <p className="mt-1 text-lg font-bold text-emerald-700 tabular-nums">
              {paidCount}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-lg bg-amber-50 p-3"
          >
            <div className="flex items-center gap-1.5 text-amber-700">
              <XCircle className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">Ödemedi</span>
            </div>
            <p className="mt-1 text-lg font-bold text-amber-700 tabular-nums">
              {unpaidCount}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-lg bg-blue-50 p-3"
          >
            <div className="flex items-center gap-1.5 text-blue-700">
              <Users className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">Toplam</span>
            </div>
            <p className="mt-1 text-lg font-bold text-blue-700 tabular-nums">
              {members.length}
            </p>
          </motion.div>
        </div>

        {/* Member List */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Üye Listesi</p>
            {unpaidCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="h-6 text-[10px]"
              >
                {selectedCount === unpaidCount ? 'Seçimi Kaldır' : 'Tümünü Seç'}
              </Button>
            )}
          </div>

          <div className="max-h-[300px] space-y-1 overflow-y-auto rounded-lg border p-2">
            {members.map((member, index) => (
              <motion.div
                key={member.membershipId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`flex items-center justify-between rounded-md px-3 py-2 transition-colors ${
                  member.hasPaid
                    ? 'bg-muted/20'
                    : selectedMembers.has(member.membershipId)
                      ? 'bg-primary/10'
                      : 'bg-muted/40 hover:bg-muted/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(member.membershipId)}
                    onChange={() => handleToggleMember(member.membershipId)}
                    disabled={member.hasPaid}
                    className="h-3.5 w-3.5 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                  />
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${member.hasPaid ? 'text-muted-foreground line-through' : ''}`}>
                      {member.fullName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.hasPaid ? (
                    <Badge variant="secondary" className="text-[9px]">
                      <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                      Ödendi
                    </Badge>
                  ) : (
                    <>
                      <Input
                        type="number"
                        value={member.amount / 100}
                        onChange={(e) => {
                          const val = Math.round(parseFloat(e.target.value || '0') * 100);
                          if (val > 0) {
                            member.amount = val;
                          }
                        }}
                        className="h-6 w-[80px] text-[10px] tabular-nums"
                        placeholder="Tutar"
                      />
                      <Badge variant="outline" className="text-[9px]">
                        {kurusToTl(member.amount)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          // TODO: Telegram hatırlatma gönder
                          console.log('Hatırlatma gönder:', member.fullName);
                        }}
                        title="Telegram hatırlatma gönder"
                      >
                        <Bell className="h-3 w-3 text-amber-500" />
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Action Bar */}
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2"
          >
            <div>
              <span className="text-xs font-medium">
                {selectedCount} üye
              </span>
              <span className="ml-2 text-sm font-bold text-primary tabular-nums">
                {kurusToTl(totalAmount)}
              </span>
            </div>
            <Button
              size="sm"
              onClick={handleCollect}
              disabled={bulkMutation.isPending}
              className="h-7 text-xs"
            >
              {bulkMutation.isPending ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                'Tahsil Et'
              )}
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
