'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Users, CheckCircle2, Clock } from 'lucide-react';

interface FeePayment {
  id: string;
  amountInKurus: number;
  month: string;
  memberName: string;
  paidAt: string;
}

interface Props {
  feePayments: FeePayment[];
  monthlyFeeAmountKurus?: number | null;
}

function kurusToTl(kurus: number): string {
  return `${(kurus / 100).toFixed(2)} TL`;
}

export function FeeTracking({ feePayments, monthlyFeeAmountKurus }: Props) {
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    const currentMonthPayments = feePayments.filter((p) => p.month === currentMonth);
    const lastMonthPayments = feePayments.filter((p) => p.month === lastMonth);

    const uniqueMembers = new Set(feePayments.map((p) => p.memberName));
    const totalPaid = feePayments.reduce((sum, p) => sum + p.amountInKurus, 0);

    const currentMonthTotal = currentMonthPayments.reduce((sum, p) => sum + p.amountInKurus, 0);
    const lastMonthTotal = lastMonthPayments.reduce((sum, p) => sum + p.amountInKurus, 0);

    const expectedAmount = monthlyFeeAmountKurus || 0;
    const collectionRate = expectedAmount > 0
      ? Math.min((currentMonthTotal / expectedAmount) * 100, 100)
      : 0;

    return {
      totalMembers: uniqueMembers.size,
      totalPaid,
      currentMonthTotal,
      lastMonthTotal,
      currentMonthPayments: currentMonthPayments.length,
      lastMonthPayments: lastMonthPayments.length,
      collectionRate,
      expectedAmount,
    };
  }, [feePayments, monthlyFeeAmountKurus]);

  const recentPayments = useMemo(() => {
    return [...feePayments]
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
      .slice(0, 8);
  }, [feePayments]);

  if (feePayments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-primary" />
            Aidat Takibi
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Henüz aidat ödemesi kaydedilmemiş.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-primary" />
          Aidat Takibi
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-emerald-50 p-3"
          >
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">Bu Ay Toplam</span>
            </div>
            <p className="mt-1 text-lg font-bold text-emerald-700 tabular-nums">
              {kurusToTl(stats.currentMonthTotal)}
            </p>
            <p className="text-[10px] text-emerald-600">
              {stats.currentMonthPayments} ödeme
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-lg bg-blue-50 p-3"
          >
            <div className="flex items-center gap-1.5 text-blue-700">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">Geçen Ay</span>
            </div>
            <p className="mt-1 text-lg font-bold text-blue-700 tabular-nums">
              {kurusToTl(stats.lastMonthTotal)}
            </p>
            <p className="text-[10px] text-blue-600">
              {stats.lastMonthPayments} ödeme
            </p>
          </motion.div>
        </div>

        {/* Collection Rate */}
        {stats.expectedAmount > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tahsilat Oranı</span>
              <span className="font-medium">%{stats.collectionRate.toFixed(1)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${stats.collectionRate}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Hedef: {kurusToTl(stats.expectedAmount)}
            </p>
          </div>
        )}

        {/* Recent Payments */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Son Ödemeler</p>
          <div className="space-y-1.5">
            {recentPayments.map((payment, index) => (
              <motion.div
                key={payment.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{payment.memberName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {payment.month}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-bold text-emerald-600 tabular-nums">
                  {kurusToTl(payment.amountInKurus)}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
          <span className="text-xs font-medium">Toplam Aidat Geliri</span>
          <span className="text-sm font-bold text-primary tabular-nums">
            {kurusToTl(stats.totalPaid)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
